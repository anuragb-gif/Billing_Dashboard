/* Daily utilization - one row per source line, no aggregation.
   {{DATE_FROM}} / {{DATE_TO}} are substituted by refresh.js. */

SELECT  [Region]
      ,U.[Primary_Customer_No]
      ,C.Name AS Customer_Name
      ,U.[Code]
      ,L.Location_Name
      ,[Frozen]
      ,[Frozen_Capacity]
      ,[Chilled]
      ,U.[Chilled_Capacity]
      ,[DRY]
      ,U.[Dry_Capacity]
      ,U.[OnDate]
  FROM Snowman_ADF_LTD.[dbo].[tblDailyUtilization] U
  LEFT JOIN tblCustomer C ON C.No = U.Primary_Customer_No
  LEFT JOIN tblLocation L ON L.Code = U.Code
  WHERE OnDate BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}';
