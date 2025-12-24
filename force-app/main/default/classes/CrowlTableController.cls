/**
 * @description Controller for the CrowlTable LWC component.
 *              Provides methods to retrieve table data with column metadata.
 * @author Generated
 */
public with sharing class CrowlTableController {

    /**
     * @description Retrieves table data with column metadata for a given record context.
     *              This is a sample implementation - developers should customize the query
     *              based on their specific object and field requirements.
     * @param recordId The context record Id (optional, can be used for parent-child queries)
     * @return JSON string containing columns metadata and row data
     */
    @AuraEnabled(cacheable=true)
    public static String getTableData(String recordId) {
        try {
            TableDataWrapper wrapper = new TableDataWrapper();

            // Example: Query Sample_Object__c records
            // Developers should replace this with their actual object and fields
            wrapper.columns = getSampleColumnMetadata();
            wrapper.rows = getSampleRowData(recordId);

            return JSON.serialize(wrapper);
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving table data: ' + e.getMessage());
        }
    }

    /**
     * @description Gets column metadata for the table.
     *              Modify this method to return actual field metadata from your object.
     * @return List of ColumnMetadata objects
     */
    private static List<ColumnMetadata> getSampleColumnMetadata() {
        List<ColumnMetadata> columns = new List<ColumnMetadata>();

        // Text field
        columns.add(new ColumnMetadata(
            'Custom_Object__c',
            'Name',
            'Name',
            'text',
            null
        ));

        // Number field
        columns.add(new ColumnMetadata(
            'Custom_Object__c',
            'Amount__c',
            'Amount',
            'number',
            null
        ));

        // Picklist field
        columns.add(new ColumnMetadata(
            'Custom_Object__c',
            'Status__c',
            'Status',
            'picklist',
            '\'Open\',\'In Progress\',\'Closed\''
        ));

        // Date field
        columns.add(new ColumnMetadata(
            'Custom_Object__c',
            'Start_Date__c',
            'Start Date',
            'date',
            null
        ));

        // Boolean field
        columns.add(new ColumnMetadata(
            'Custom_Object__c',
            'Is_Active__c',
            'Active',
            'boolean',
            null
        ));

        return columns;
    }

    /**
     * @description Gets row data for the table.
     *              Modify this method to query actual records from your object.
     * @param recordId Context record Id for filtering
     * @return List of maps representing row data
     */
    private static List<Map<String, Object>> getSampleRowData(String recordId) {
        List<Map<String, Object>> rows = new List<Map<String, Object>>();

        // Sample data - replace with actual SOQL query
        // Example:
        // for (Custom_Object__c record : [SELECT Id, Name, Amount__c, Status__c, Start_Date__c, Is_Active__c
        //                                  FROM Custom_Object__c
        //                                  WHERE Parent__c = :recordId
        //                                  LIMIT 1000]) {
        //     Map<String, Object> row = new Map<String, Object>();
        //     row.put('Id', record.Id);
        //     row.put('Name', record.Name);
        //     row.put('Amount__c', record.Amount__c);
        //     row.put('Status__c', record.Status__c);
        //     row.put('Start_Date__c', record.Start_Date__c);
        //     row.put('Is_Active__c', record.Is_Active__c);
        //     rows.add(row);
        // }

        // Generate sample data for demonstration
        List<String> statuses = new List<String>{'Open', 'In Progress', 'Closed'};

        for (Integer i = 1; i <= 50; i++) {
            Map<String, Object> row = new Map<String, Object>();
            row.put('Id', 'a00' + String.valueOf(i).leftPad(10, '0') + 'ABC');
            row.put('Name', 'Record ' + i);
            row.put('Amount__c', Math.round(Math.random() * 10000 * 100) / 100.0);
            row.put('Status__c', statuses[Math.mod(i, 3)]);
            row.put('Start_Date__c', Date.today().addDays(Math.mod(i, 90)));
            row.put('Is_Active__c', Math.mod(i, 2) == 0);
            rows.add(row);
        }

        return rows;
    }

    /**
     * @description Helper method to get picklist values for a field.
     * @param objectApiName The API name of the object
     * @param fieldApiName The API name of the picklist field
     * @return Comma-separated string of picklist values in format 'value1','value2'
     */
    public static String getPicklistValues(String objectApiName, String fieldApiName) {
        List<String> values = new List<String>();

        Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName);
        if (sObjectType != null) {
            Schema.DescribeSObjectResult describeResult = sObjectType.getDescribe();
            Schema.SObjectField field = describeResult.fields.getMap().get(fieldApiName);

            if (field != null) {
                Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
                if (fieldDescribe.getType() == Schema.DisplayType.PICKLIST) {
                    for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
                        if (entry.isActive()) {
                            values.add('\'' + entry.getValue() + '\'');
                        }
                    }
                }
            }
        }

        return String.join(values, ',');
    }

    /**
     * @description Helper method to determine the data type of a field.
     * @param fieldDescribe The field describe result
     * @return String representing the simplified data type
     */
    public static String getFieldDataType(Schema.DescribeFieldResult fieldDescribe) {
        Schema.DisplayType displayType = fieldDescribe.getType();

        switch on displayType {
            when STRING, TEXTAREA, EMAIL, URL, PHONE, ID {
                return 'text';
            }
            when INTEGER, DOUBLE, CURRENCY, PERCENT {
                return 'number';
            }
            when PICKLIST {
                return 'picklist';
            }
            when DATE, DATETIME {
                return 'date';
            }
            when BOOLEAN {
                return 'boolean';
            }
            when else {
                return 'text'; // Default to text for unsupported types
            }
        }
    }

    /**
     * @description Wrapper class for column metadata
     */
    public class ColumnMetadata {
        @AuraEnabled public String object_api { get; set; }
        @AuraEnabled public String field_api { get; set; }
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String dataType { get; set; }
        @AuraEnabled public String picklistValues { get; set; }

        public ColumnMetadata(String objectApi, String fieldApi, String lbl, String dtype, String values) {
            this.object_api = objectApi;
            this.field_api = fieldApi;
            this.label = lbl;
            this.dataType = dtype;
            this.picklistValues = values;
        }
    }

    /**
     * @description Wrapper class for table data response
     */
    public class TableDataWrapper {
        @AuraEnabled public List<ColumnMetadata> columns { get; set; }
        @AuraEnabled public List<Map<String, Object>> rows { get; set; }

        public TableDataWrapper() {
            this.columns = new List<ColumnMetadata>();
            this.rows = new List<Map<String, Object>>();
        }
    }
}
