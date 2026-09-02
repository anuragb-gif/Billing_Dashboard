/* Throughput - inward/outward quantity and pallets per day, by customer,
   location, region and storage type.
   {{DATE_FROM}} / {{DATE_TO}} are substituted by refresh.js. */

select
    Posting_Date,
    Location_Code,
    Location_Name,
    Region,
    StorageType,
    Customer_No,
    Customer_name,
    cast(isnull(sum(Inward_Qty),0) as numeric(36,2)) Inward_Qty,
    cast(isnull(sum(Outward_Qty),0) as numeric(36,2)) Outward_Qty,
    cast(isnull(sum(Inward_Pallet),0) as numeric(36,2)) Inward_Pallet,
    cast(isnull(sum(Outward_Pallet),0) as numeric(36,2)) Outward_Pallet
from
(
    select
        convert(date, ile.PostingDate) Posting_Date,
        ile.LocationCode   Location_Code,
        l.Location_Name,
        l.Territory_Code as [Region],
        ile.StorageType,
        ile.PrimaryCustomerNo as Customer_No,
        ile.ItemNo  Item_No,
        C.Name Customer_name,
        case when EntryType = 'Purchase' then sum(Quantity) end as Inward_Qty,
        case when EntryType = 'Sale' then sum(Quantity) end as Outward_Qty,
        case when EntryType = 'Purchase' then sum(QuantityinPallets) end as Inward_Pallet,
        case when EntryType = 'Sale' then sum(QuantityinPallets) end as Outward_Pallet
    from tblItemLedgerEntry ile
    left join tblLocation l on ile.LocationCode = l.Code
    left join tblCustomer C on C.No = ile.PrimaryCustomerNo
    where convert(date, PostingDate) BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
    group by ile.PostingDate,
        ile.LocationCode,
        ile.PrimaryCustomerNo,
        ile.ItemNo,
        EntryType,
        C.Name,
        l.Location_Name,
        l.Territory_Code,
        ile.StorageType
) t
where Customer_No <> ''
group by
    Posting_Date,
    Customer_No,
    Customer_name,
    Location_Code,
    Location_Name,
    Region,
    StorageType;
