/* ==========================================================================
   BILLING REPORT - OPTIMIZED VERSION
   Same output/logic as the original, computed without the day x history
   self-join. {{DATE_FROM}} / {{DATE_TO}} are substituted by refresh.js
   (rolling ~13-month window).
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
-- 0. Customer filter list (deduped once, indexed, seekable)
-------------------------------------------------------------------------
CREATE TABLE #Cust (CustNo varchar(20) PRIMARY KEY);

INSERT INTO #Cust (CustNo)
SELECT DISTINCT v.CustNo
FROM (VALUES
('BLGP000193'),('JPUP000065'),('HYBP000483'),('MBIP000179'),('MMBP000239'),
('VRNP000176'),('VRNP000177'),('GUAP000038'),('GUAP000022'),('CONP000005'),
('CHNP000718'),('CHNP000664'),('CHNP000663'),('CNEP000093'),('PNNP000040'),
('KDYP000006'),('KKTP000338'),('KDYP000005'),('KKTP000337'),('KKTP000150'),
('CHNP000007'),('CONP000053'),('MUBP000063'),('VIRP000080'),('VIZP000005'),
('KKTP000075'),('VIZP000291'),('PNEP000007'),('PNEP000018'),('KKTP000007'),
('MUMP000199'),('KKTP000420'),('KDYP000009'),('BLGP000121'),('KDYP000011'),
('VRNP000016'),('CNEP000050'),('HYBP000046'),('CONP000044'),('VRNP000104'),
('HYBP000396'),('VRNP000099'),('VRNP000098'),('CONP000223'),('MMBP000208'),
('MMBP000213'),('MUMP000351'),('MMBP000203'),('MMBP000198'),('VRNP000125'),
('MMBP000207'),('VRNP000113'),('MMBP000159'),('MMBP000160'),('BLGP000126'),
('VRNP000040'),('MBIP000079'),('KKTP000006'),('BLGP000063'),('VRNP000112'),
('BLGP000128'),('CNEP000037'),('KKTP000285'),('KDYP000003'),('MUMP000056'),
('CHNP000395'),('AHMP000259'),('PUJP000067'),('VRNP000049'),('BLBP000864'),
('BLGP000145'),('MMBP000200'),('VIRP000321'),('CNEP000108'),('VIRP000748'),
('KKTP000073'),('KDYP000002'),('MUMP000321'),('MMBP000098'),('VRNP000011'),
('PNNP000031'),('PUJP000147'),('PUNP000009'),('CHNP000472'),('PNNP000057'),
('KKTP000013'),('CONP000031'),('CHNP000235'),('PNNP000038'),('MUBP000046'),
('BLGP000003'),('PUJP000048'),('HYBP000093'),('VGNP000160'),('PUNP000304'),
('VIGP000022'),('VIZP000148'),('HBDP000001'),('KDYP000001'),('KKTP000018'),
('CONP000162'),('JPUP000040'),('KDYP000008'),('KKTP000356'),('CONP000077'),
('PUJP000070')
) v(CustNo);

-------------------------------------------------------------------------
-- 1. Balance carried in from BEFORE the report window
--    (single aggregate per combo - no self join, no per-day expansion)
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
-- 2. Daily movement WITHIN the report window only (small: combos x days)
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
-- 3. Every combo that needs a row (has prior balance and/or activity now)
-------------------------------------------------------------------------
SELECT ItemNo, CustomerNo, LocationCode, StorageType INTO #Combos FROM #Prior
UNION
SELECT ItemNo, CustomerNo, LocationCode, StorageType FROM #Window;

-------------------------------------------------------------------------
-- 4. Calendar spine - just the report range, not full history
-------------------------------------------------------------------------
SELECT [Date] INTO #Cal FROM Calender WHERE [Date] BETWEEN @DateFrom AND @DateTo;

-------------------------------------------------------------------------
-- 5. Roll the balance forward with a window function (cheap: combos x days)
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
    ISNULL(UOM.qtyperUnitofMeasure, 0)         AS [Item Conversion],
    (r.PriorBalance + r.CumNet - r.NetQty) / NULLIF(UOM.qtyperUnitofMeasure, 0) AS [Op Pal],
    r.InQty  / NULLIF(UOM.qtyperUnitofMeasure, 0) AS [In Pal],
    r.OutQty / NULLIF(UOM.qtyperUnitofMeasure, 0) AS [Out Pal],
    (r.PriorBalance + r.CumNet) / NULLIF(UOM.qtyperUnitofMeasure, 0) AS [Cl pal]
FROM Running r
JOIN tblItem Item ON Item.No = r.ItemNo
LEFT JOIN tblCustomer Cust ON Cust.No = r.CustomerNo
LEFT JOIN tblItemUnitOfMeasure UOM ON UOM.ItemNo = r.ItemNo AND UOM.Code = 'PALLET'
WHERE (r.PriorBalance + r.CumNet - r.NetQty) + r.InQty + r.OutQty + (r.PriorBalance + r.CumNet) <> 0;
