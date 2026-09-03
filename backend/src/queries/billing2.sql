/* ==========================================================================
   BILLING GU REPORT
   Identical roll-forward logic to billing.sql, but for a different customer
   set and with PALLET / BILL KG / CASE conversions instead of PALLET only.
   {{DATE_FROM}} / {{DATE_TO}} are substituted by refresh.js.
   ========================================================================== */

SET NOCOUNT ON;

DECLARE @DateFrom date = '{{DATE_FROM}}';
DECLARE @DateTo   date = '{{DATE_TO}}';

IF OBJECT_ID('tempdb..#Cust')    IS NOT NULL DROP TABLE #Cust;
IF OBJECT_ID('tempdb..#Prior')   IS NOT NULL DROP TABLE #Prior;
IF OBJECT_ID('tempdb..#Window')  IS NOT NULL DROP TABLE #Window;
IF OBJECT_ID('tempdb..#Combos')  IS NOT NULL DROP TABLE #Combos;
IF OBJECT_ID('tempdb..#Cal')     IS NOT NULL DROP TABLE #Cal;

-------------------------------------------------------------------------
-- 0. Customer filter list
-------------------------------------------------------------------------
CREATE TABLE #Cust (CustNo varchar(20) PRIMARY KEY);

INSERT INTO #Cust (CustNo)
SELECT DISTINCT v.CustNo
FROM (VALUES
('GUAP000036'),('GUAP000069'),('GUAP000094'),('GUAP000111'),('GUAP000128'),
('GUAP000029'),('GUAP000004'),('GUAP000005'),('GUAP000010'),('GUAP000040'),
('GUAP000042'),('GUAP000059'),('GUAP000110'),('GUAP000127'),('GUAP000117'),
('GUAP000101')
) v(CustNo);

-------------------------------------------------------------------------
-- 1. Balance carried in from BEFORE the report window
-------------------------------------------------------------------------
SELECT
    ILE.ItemNo,
    ILE.PrimaryCustomerNo AS CustomerNo,
    ILE.LocationCode,
    ILE.StorageType,
    SUM(ILE.Quantity) AS PriorBalance
INTO #Prior
FROM tblItemLedgerEntry ILE
JOIN #Cust c    ON c.CustNo = ILE.PrimaryCustomerNo
JOIN tblItem Item ON Item.No = ILE.ItemNo AND Item.Blocked <> 1
WHERE ILE.PostingDate < @DateFrom
GROUP BY ILE.ItemNo, ILE.PrimaryCustomerNo, ILE.LocationCode, ILE.StorageType;

-------------------------------------------------------------------------
-- 2. Daily movement WITHIN the report window only
-------------------------------------------------------------------------
SELECT
    ILE.ItemNo,
    ILE.PrimaryCustomerNo AS CustomerNo,
    ILE.LocationCode,
    ILE.StorageType,
    CAST(ILE.PostingDate AS date) AS TxnDate,
    SUM(CASE WHEN ILE.Quantity > 0 THEN ILE.Quantity ELSE 0 END) AS InQty,
    SUM(CASE WHEN ILE.Quantity < 0 THEN -ILE.Quantity ELSE 0 END) AS OutQty,
    SUM(ILE.Quantity) AS NetQty
INTO #Window
FROM tblItemLedgerEntry ILE
JOIN #Cust c    ON c.CustNo = ILE.PrimaryCustomerNo
JOIN tblItem Item ON Item.No = ILE.ItemNo AND Item.Blocked <> 1
WHERE ILE.PostingDate BETWEEN @DateFrom AND @DateTo
GROUP BY ILE.ItemNo, ILE.PrimaryCustomerNo, ILE.LocationCode, ILE.StorageType,
         CAST(ILE.PostingDate AS date);

-------------------------------------------------------------------------
-- 3. Every combo that needs a row
-------------------------------------------------------------------------
SELECT ItemNo, CustomerNo, LocationCode, StorageType INTO #Combos FROM #Prior
UNION
SELECT ItemNo, CustomerNo, LocationCode, StorageType FROM #Window;

-------------------------------------------------------------------------
-- 4. Calendar spine
-------------------------------------------------------------------------
SELECT [Date] INTO #Cal FROM Calender WHERE [Date] BETWEEN @DateFrom AND @DateTo;

-------------------------------------------------------------------------
-- 5. Roll the balance forward --- Need to combine the prior balance with the daily movement to get a running total for each day in the report window.
-------------------------------------------------------------------------
;WITH Spine AS (
    SELECT
        cb.ItemNo, cb.CustomerNo, cb.LocationCode, cb.StorageType,
        cal.[Date] AS TxnDate,
        ISNULL(w.InQty, 0)  AS InQty,
        ISNULL(w.OutQty, 0) AS OutQty,
        ISNULL(w.NetQty, 0) AS NetQty
    FROM #Combos cb
    CROSS JOIN #Cal cal
    LEFT JOIN #Window w
        ON  w.ItemNo = cb.ItemNo AND w.CustomerNo = cb.CustomerNo
        AND w.LocationCode = cb.LocationCode AND w.StorageType = cb.StorageType
        AND w.TxnDate = cal.[Date]
),
Running AS (
    SELECT
        s.*,
        ISNULL(p.PriorBalance, 0) AS PriorBalance,
        SUM(s.NetQty) OVER (PARTITION BY s.ItemNo, s.CustomerNo, s.LocationCode, s.StorageType
                             ORDER BY s.TxnDate
                             ROWS UNBOUNDED PRECEDING) AS CumNet
    FROM Spine s
    LEFT JOIN #Prior p
        ON  p.ItemNo = s.ItemNo AND p.CustomerNo = s.CustomerNo
        AND p.LocationCode = s.LocationCode AND p.StorageType = s.StorageType
)
SELECT
    r.TxnDate                                  AS [Date],
    r.ItemNo                                   AS [Item_No],
    Item.[Description]                         AS [Item Name],
    Item.[Base_Unit_of_Measure]                AS [Base UOM],
    r.StorageType                              AS [StorageType],
    r.LocationCode                             AS [Location Code],
    r.PriorBalance + r.CumNet - r.NetQty       AS [Opening],
    r.InQty                                    AS [In Quantity],
    r.OutQty                                   AS [Out Quantity],
    r.PriorBalance + r.CumNet                  AS [Closing],
    CASE WHEN Item.Blocked = 1 THEN 'Non Active' ELSE 'Active' END AS [Status],
    r.CustomerNo                               AS [Customer No],
    Cust.Name                                  AS [Customer Name],

    ISNULL(UOM_PAL.qtyperUnitofMeasure, 0)     AS [PALLET Conv],
    (r.PriorBalance + r.CumNet - r.NetQty) / NULLIF(UOM_PAL.qtyperUnitofMeasure, 0) AS [Op Pal],
    r.InQty  / NULLIF(UOM_PAL.qtyperUnitofMeasure, 0) AS [In Pal],
    r.OutQty / NULLIF(UOM_PAL.qtyperUnitofMeasure, 0) AS [Out Pal],
    (r.PriorBalance + r.CumNet) / NULLIF(UOM_PAL.qtyperUnitofMeasure, 0) AS [Cl Pal],

    ISNULL(UOM_BK.qtyperUnitofMeasure, 0)      AS [BILLKG Conv],
    (r.PriorBalance + r.CumNet - r.NetQty) / NULLIF(UOM_BK.qtyperUnitofMeasure, 0) AS [Op BillKg],
    r.InQty  / NULLIF(UOM_BK.qtyperUnitofMeasure, 0) AS [In BillKg],
    r.OutQty / NULLIF(UOM_BK.qtyperUnitofMeasure, 0) AS [Out BillKg],
    (r.PriorBalance + r.CumNet) / NULLIF(UOM_BK.qtyperUnitofMeasure, 0) AS [Cl BillKg],

    ISNULL(UOM_CS.qtyperUnitofMeasure, 0)      AS [CASE Conv],
    (r.PriorBalance + r.CumNet - r.NetQty) / NULLIF(UOM_CS.qtyperUnitofMeasure, 0) AS [Op Case],
    r.InQty  / NULLIF(UOM_CS.qtyperUnitofMeasure, 0) AS [In Case],
    r.OutQty / NULLIF(UOM_CS.qtyperUnitofMeasure, 0) AS [Out Case],
    (r.PriorBalance + r.CumNet) / NULLIF(UOM_CS.qtyperUnitofMeasure, 0) AS [Cl Case]
FROM Running r
JOIN tblItem Item ON Item.No = r.ItemNo
LEFT JOIN tblCustomer Cust ON Cust.No = r.CustomerNo
LEFT JOIN tblItemUnitOfMeasure UOM_PAL ON UOM_PAL.ItemNo = r.ItemNo AND UOM_PAL.Code = 'PALLET'
LEFT JOIN tblItemUnitOfMeasure UOM_BK  ON UOM_BK.ItemNo  = r.ItemNo AND UOM_BK.Code  = 'BILL KG'
LEFT JOIN tblItemUnitOfMeasure UOM_CS  ON UOM_CS.ItemNo  = r.ItemNo AND UOM_CS.Code  = 'CASE'
WHERE (r.PriorBalance + r.CumNet - r.NetQty) + r.InQty + r.OutQty + (r.PriorBalance + r.CumNet) <> 0;
