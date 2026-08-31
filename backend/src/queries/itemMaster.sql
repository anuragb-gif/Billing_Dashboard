/* Item Master - full replace every run (no date window).
   Output columns are kept exactly as the report expects them. */

SELECT
    'Snowman Logistics Limited' AS Report,
    I.LocationCode,
    I.PrimaryCustomerNo AS [Customer],
    L.Location_Name AS [Location],
    C.Name AS [Customer Name],
    I.ItemNo,

    SUM(I.MinBillableQuantity) AS [Min_Billable Quantity],

    UOM.PalletConv,
    UOM.KGConv,
    UOM.CASEConv,
    UOM.CRATEConv,
    UOM.BILLKGConv,
    UOM.BAGConv,
    UOM.BOTTLEConv,
    UOM.BOXConv,
    UOM.BUCKETConv,
    UOM.DRUMConv,
    UOM.EACHConv,
    UOM.NOSConv,
    UOM.PCSConv,
    UOM.PKTConv,

    CAST(I.BillingCategoryQty AS NUMERIC(19,2)) AS [Billing Category Qty],
    I.BillingCategoryUOM,

    IT.Storage_Type,
    IT.Unit_Price,
    IT.Base_Unit_of_Measure,

    ISNULL(ILE.Quantity,0) AS Quantity,

    ISNULL(
        CAST(
            ILE.Quantity / NULLIF(UOM.PalletConv,0)
            AS NUMERIC(19,2)
        ),0
    ) AS [Qty in Pal],

    IT.Description AS [Item Name]

FROM tblStockKeepingUnit I

LEFT JOIN tblLocation L
    ON I.LocationCode = L.Code

LEFT JOIN tblCustomer C
    ON I.PrimaryCustomerNo = C.No

LEFT JOIN tblItem IT
    ON I.ItemNo = IT.No

LEFT JOIN
(
    SELECT
        ItemNo,
        PrimaryCustomerNo,
        SUM(Quantity) AS Quantity
    FROM tblItemLedgerEntry
    GROUP BY ItemNo, PrimaryCustomerNo
) ILE
ON I.ItemNo = ILE.ItemNo
AND I.PrimaryCustomerNo = ILE.PrimaryCustomerNo

LEFT JOIN
(
    SELECT
        ItemNo,

        MAX(CASE WHEN Code='PALLET' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS PalletConv,
        MAX(CASE WHEN Code='KG' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS KGConv,
        MAX(CASE WHEN Code='CASE' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS CASEConv,
        MAX(CASE WHEN Code='CRATE' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS CRATEConv,
        MAX(CASE WHEN Code='BILL KG' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS BILLKGConv,
        MAX(CASE WHEN Code='BAG' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS BAGConv,
        MAX(CASE WHEN Code='BOTTLE' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS BOTTLEConv,
        MAX(CASE WHEN Code='BOX' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS BOXConv,
        MAX(CASE WHEN Code='BUCKET' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS BUCKETConv,
        MAX(CASE WHEN Code='DRUM' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS DRUMConv,
        MAX(CASE WHEN Code='EACH' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS EACHConv,
        MAX(CASE WHEN Code='NOS' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS NOSConv,
        MAX(CASE WHEN Code='PCS' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS PCSConv,
        MAX(CASE WHEN Code='PKT' THEN CAST(QtyPerUnitOfMeasure AS NUMERIC(19,2)) END) AS PKTConv

    FROM tblItemUnitOfMeasure
    GROUP BY ItemNo
) UOM
ON I.ItemNo = UOM.ItemNo

WHERE I.LocationCode NOT IN
(
'CHD','MDS','HO','HDB','COK','CHE','GOA','HYD','KNA','NAG',
'PHL','SEW','VSK','VZG','MBI-FSD','HYB-FSD','VIR-WYN',
'VRN-FSD','HYB-WYN','GZB','INTRANSIT','BOM-WYN'
)

AND I.ItemNo NOT IN
(
'OCI00001','OCI00002','OCI00003','OCI00004','OCI00005',
'OCI00006','OCI00007','OCI0008','OCI00009','OCI00010',
'OCI00011','OCI00012','OCI00013','OCI00014','OCI00015',
'OCI00016','OCI00017','OCI00018','OCI00019','OCI00020',
'OCI00021','OCI00022','OCI00023','OCI00024',
'PLT00001','PLT00002','PLT00003','PLT00004',
'PLT00005','PLT00006','PLT00007','PLT00008',
'PLT00009','PLT00010','PLT00011','PLT00012'
)
AND c.Name IS NOT NULL
GROUP BY
I.LocationCode,
I.PrimaryCustomerNo,
L.Location_Name,
C.Name,
I.ItemNo,
I.BillingCategoryQty,
I.BillingCategoryUOM,
IT.Storage_Type,
IT.Unit_Price,
IT.Base_Unit_of_Measure,
IT.Description,
ILE.Quantity,
UOM.PalletConv,
UOM.KGConv,
UOM.CASEConv,
UOM.CRATEConv,
UOM.BILLKGConv,
UOM.BAGConv,
UOM.BOTTLEConv,
UOM.BOXConv,
UOM.BUCKETConv,
UOM.DRUMConv,
UOM.EACHConv,
UOM.NOSConv,
UOM.PCSConv,
UOM.PKTConv;
