/**
 * Mock Data Generator for ExcelLikeTable component
 * Use this for local testing and Lightning Component Preview
 */

const FIRST_NAMES = [
    'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Emma',
    'Robert', 'Olivia', 'William', 'Sophia', 'Richard', 'Isabella', 'Joseph',
    'Mia', 'Thomas', 'Charlotte', 'Christopher', 'Amelia'
];

const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

const STATUSES = ['Open', 'In Progress', 'Closed', 'On Hold', 'Cancelled'];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Generates a random date between start and end dates
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {string} - ISO date string (YYYY-MM-DD)
 */
function randomDate(start = new Date(2024, 0, 1), end = new Date(2025, 11, 31)) {
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split('T')[0];
}

/**
 * Generates a random element from an array
 * @param {Array} arr - Source array
 * @returns {*} - Random element
 */
function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a random number within a range
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} decimals - Number of decimal places
 * @returns {number} - Random number
 */
function randomNumber(min = 0, max = 10000, decimals = 2) {
    const value = min + Math.random() * (max - min);
    return Number(value.toFixed(decimals));
}

/**
 * Generates a unique Salesforce-like ID
 * @param {number} index - Row index
 * @param {string} prefix - ID prefix
 * @returns {string} - Unique ID
 */
function generateId(index, prefix = 'a00') {
    return `${prefix}${String(index).padStart(12, '0')}ABC`;
}

/**
 * Generates a random name
 * @param {number} index - Row index for uniqueness
 * @returns {string} - Full name
 */
function generateName(index) {
    const firstName = randomFrom(FIRST_NAMES);
    const lastName = randomFrom(LAST_NAMES);
    return `${firstName} ${lastName} ${index}`;
}

/**
 * Generates mock column metadata
 * @returns {Array} - Column definitions
 */
export function generateColumns() {
    return [
        {
            object_api: 'Sample_Object__c',
            field_api: 'Name',
            label: 'Name',
            'data-type': 'text',
            values: null
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Amount__c',
            label: 'Amount',
            'data-type': 'number',
            values: null
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Status__c',
            label: 'Status',
            'data-type': 'picklist',
            values: STATUSES.map(s => `'${s}'`).join(',')
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Priority__c',
            label: 'Priority',
            'data-type': 'picklist',
            values: PRIORITIES.map(p => `'${p}'`).join(',')
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Start_Date__c',
            label: 'Start Date',
            'data-type': 'date',
            values: null
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Due_Date__c',
            label: 'Due Date',
            'data-type': 'date',
            values: null
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Is_Active__c',
            label: 'Active',
            'data-type': 'boolean',
            values: null
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Is_Approved__c',
            label: 'Approved',
            'data-type': 'boolean',
            values: null
        },
        {
            object_api: 'Sample_Object__c',
            field_api: 'Description__c',
            label: 'Description',
            'data-type': 'text',
            values: null
        }
    ];
}

/**
 * Generates mock row data
 * @param {number} count - Number of rows to generate
 * @returns {Array} - Array of row objects
 */
export function generateRows(count = 200) {
    const rows = [];

    for (let i = 1; i <= count; i++) {
        const startDate = randomDate(new Date(2024, 0, 1), new Date(2025, 6, 1));
        const dueDate = randomDate(new Date(startDate), new Date(2025, 11, 31));

        rows.push({
            Id: generateId(i),
            Name: generateName(i),
            Amount__c: randomNumber(100, 50000, 2),
            Status__c: randomFrom(STATUSES),
            Priority__c: randomFrom(PRIORITIES),
            Start_Date__c: startDate,
            Due_Date__c: dueDate,
            Is_Active__c: Math.random() > 0.3,
            Is_Approved__c: Math.random() > 0.5,
            Description__c: `Task item ${i} - ${randomFrom(['Review', 'Update', 'Complete', 'Process', 'Verify'])} ${randomFrom(['documents', 'records', 'data', 'files', 'reports'])}`
        });
    }

    return rows;
}

/**
 * Generates complete mock table data (columns + rows)
 * @param {number} rowCount - Number of rows to generate
 * @returns {Object} - { columns: [], rows: [] }
 */
export function generateMockTableData(rowCount = 200) {
    return {
        columns: generateColumns(),
        rows: generateRows(rowCount)
    };
}

/**
 * Default export for convenience
 */
export default {
    generateColumns,
    generateRows,
    generateMockTableData,
    STATUSES,
    PRIORITIES
};
