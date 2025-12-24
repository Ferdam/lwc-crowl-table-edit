import { LightningElement, api, track } from 'lwc';
import { generateMockTableData } from './mockDataGenerator';

// Uncomment these imports when deploying to org with Apex
// import { wire } from 'lwc';
// import getTableData from '@salesforce/apex/ExcelLikeTableController.getTableData';

const SEARCH_DEBOUNCE_MS = 300;
const VIRTUAL_SCROLL_THRESHOLD = 500;
const VIRTUAL_SCROLL_BUFFER = 20;
const ROW_HEIGHT = 32; // Approximate row height in pixels

export default class ExcelLikeTable extends LightningElement {
    // Public API properties
    @api recordId;
    @api useApex = false; // Set to true to load data from Apex

    // Tracked state
    @track columns = [];
    @track originalData = [];
    @track workingData = [];
    @track visibleRowIds = new Set();
    @track hiddenRowIds = new Set();
    @track selectedRowIds = new Set();
    @track hiddenRowCheckboxStates = new Map();
    @track editedCells = new Map(); // key: 'rowId_fieldApi', value: true
    @track columnMetadataMap = new Map(); // key: fieldApi, value: column metadata

    // Component state
    @track isInlineEditMode = false;
    @track isLoading = true;
    @track searchTerm = '';
    @track activeHeaderEditColumn = null;
    @track headerEditValue = null;
    @track hiddenRowCount = 0;
    @track error = null;

    // Virtual scrolling state
    @track virtualScrollEnabled = false;
    @track scrollTop = 0;
    @track visibleStartIndex = 0;
    @track visibleEndIndex = 50;

    // Private properties
    _searchDebounceTimer;
    _focusedCellKey = null;
    _workingDataMap = new Map(); // For O(1) row lookups

    // Wire Apex data - uncomment when deploying to org
    // @wire(getTableData, { recordId: '$recordId' })
    // wiredTableData({ error, data }) {
    //     if (this.useApex) {
    //         if (data) {
    //             try {
    //                 const parsedData = JSON.parse(data);
    //                 const convertedData = {
    //                     columns: parsedData.columns.map(col => ({
    //                         object_api: col.object_api,
    //                         field_api: col.field_api,
    //                         label: col.label,
    //                         'data-type': col.dataType,
    //                         values: col.picklistValues
    //                     })),
    //                     rows: parsedData.rows
    //                 };
    //                 this.processTableData(convertedData);
    //             } catch (e) {
    //                 this.error = 'Error parsing table data: ' + e.message;
    //                 this.isLoading = false;
    //             }
    //         } else if (error) {
    //             this.error = error.body ? error.body.message : error.message;
    //             this.isLoading = false;
    //         }
    //     }
    // }

    // Lifecycle hooks
    connectedCallback() {
        // Always use mock data for local preview testing
        this.initializeMockData();
    }

    renderedCallback() {
        // Setup virtual scroll listener if needed
        if (this.virtualScrollEnabled) {
            const container = this.template.querySelector('.table-container');
            if (container && !container._scrollListenerAdded) {
                container.addEventListener('scroll', this.handleTableScroll.bind(this));
                container._scrollListenerAdded = true;
            }
        }
    }

    // Public API methods
    @api
    getWorkingData() {
        return JSON.parse(JSON.stringify(this.workingData));
    }

    @api
    getModifiedRows() {
        const modifiedRows = [];
        const editedRowIds = new Set();

        this.editedCells.forEach((value, key) => {
            const rowId = key.split('_')[0];
            editedRowIds.add(rowId);
        });

        editedRowIds.forEach(rowId => {
            const row = this._workingDataMap.get(rowId);
            if (row) {
                modifiedRows.push(JSON.parse(JSON.stringify(row)));
            }
        });

        return modifiedRows;
    }

    @api
    getOriginalData() {
        return JSON.parse(JSON.stringify(this.originalData));
    }

    @api
    setTableData(data) {
        if (data && data.columns && data.rows) {
            this.processTableData(data);
        }
    }

    @api
    resetToOriginal() {
        this.workingData = JSON.parse(JSON.stringify(this.originalData));
        this.buildWorkingDataMap();
        this.visibleRowIds = new Set(this.workingData.map(row => row.Id));
        this.hiddenRowIds.clear();
        this.selectedRowIds.clear();
        this.hiddenRowCheckboxStates.clear();
        this.editedCells.clear();
        this.hiddenRowCount = 0;
        this.searchTerm = '';
    }

    @api
    getSelectedRowIds() {
        return Array.from(this.selectedRowIds);
    }

    @api
    getEditedCellKeys() {
        return Array.from(this.editedCells.keys());
    }

    // Initialize with mock data from generator module
    initializeMockData() {
        // Generate 200 rows of mock data with all data types
        const mockData = generateMockTableData(200);
        this.processTableData(mockData);
    }

    processTableData(data) {
        this.isLoading = true;

        try {
            // Process columns
            this.columns = data.columns.map(col => ({
                ...col,
                dataType: col['data-type'],
                picklistValues: this.parsePicklistValues(col.values)
            }));

            // Build column metadata map
            this.columnMetadataMap.clear();
            this.columns.forEach(col => {
                this.columnMetadataMap.set(col.field_api, col);
            });

            // Deep copy data
            this.originalData = JSON.parse(JSON.stringify(data.rows));
            this.workingData = JSON.parse(JSON.stringify(data.rows));

            // Build lookup map for performance
            this.buildWorkingDataMap();

            // Initialize visible rows (all rows visible initially)
            this.visibleRowIds = new Set(this.workingData.map(row => row.Id));
            this.hiddenRowIds.clear();
            this.selectedRowIds.clear();
            this.hiddenRowCheckboxStates.clear();
            this.editedCells.clear();
            this.hiddenRowCount = 0;

            // Enable virtual scrolling for large datasets
            this.virtualScrollEnabled = this.workingData.length > VIRTUAL_SCROLL_THRESHOLD;
            if (this.virtualScrollEnabled) {
                this.visibleStartIndex = 0;
                this.visibleEndIndex = Math.min(50 + VIRTUAL_SCROLL_BUFFER, this.workingData.length);
            }

            this.isLoading = false;
        } catch (e) {
            this.error = e.message;
            this.isLoading = false;
        }
    }

    buildWorkingDataMap() {
        this._workingDataMap.clear();
        this.workingData.forEach(row => {
            this._workingDataMap.set(row.Id, row);
        });
    }

    parsePicklistValues(valuesString) {
        if (!valuesString) return [];

        // Parse "'value1','value2'" format
        const matches = valuesString.match(/'([^']+)'/g);
        if (!matches) return [];

        return matches.map(m => ({
            label: m.replace(/'/g, ''),
            value: m.replace(/'/g, '')
        }));
    }

    // Computed properties
    get filteredRows() {
        let rows = this.workingData.filter(row => this.visibleRowIds.has(row.Id));

        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            rows = rows.filter(row => {
                return this.columns.some(col => {
                    const value = row[col.field_api];
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(searchLower);
                });
            });
        }

        return rows;
    }

    get displayRows() {
        let rows = this.filteredRows;

        // Apply virtual scrolling if enabled
        if (this.virtualScrollEnabled) {
            rows = rows.slice(this.visibleStartIndex, this.visibleEndIndex);
        }

        // Map rows with additional display properties
        return rows.map(row => ({
            ...row,
            _isSelected: this.selectedRowIds.has(row.Id),
            _rowCheckboxId: `row-checkbox-${row.Id}`,
            _cells: this.columns.map(col => {
                const cellValue = row[col.field_api];
                const cellKey = `${row.Id}_${col.field_api}`;
                // Pre-compute picklist options with selected state
                const picklistOptions = col.picklistValues
                    ? col.picklistValues.map(opt => ({
                        ...opt,
                        selected: opt.value === cellValue
                    }))
                    : [];

                const isBoolean = col.dataType === 'boolean';
                return {
                    fieldApi: col.field_api,
                    value: cellValue,
                    displayValue: this.formatDisplayValue(cellValue, col.dataType),
                    dataType: col.dataType,
                    picklistOptions: picklistOptions,
                    isEdited: this.editedCells.has(cellKey),
                    cellKey: cellKey,
                    cellBooleanId: `cell-bool-${cellKey}`,
                    isText: col.dataType === 'text',
                    isNumber: col.dataType === 'number',
                    isPicklist: col.dataType === 'picklist',
                    isDate: col.dataType === 'date',
                    isBoolean: isBoolean,
                    isNotBoolean: !isBoolean
                };
            })
        }));
    }

    get displayColumns() {
        return this.columns.map(col => {
            const isEditing = this.activeHeaderEditColumn === col.field_api;
            return {
                ...col,
                isEditing: isEditing,
                isNotEditing: !isEditing,
                headerBooleanId: `header-bool-${col.field_api}`,
                isText: col.dataType === 'text',
                isNumber: col.dataType === 'number',
                isPicklist: col.dataType === 'picklist',
                isDate: col.dataType === 'date',
                isBoolean: col.dataType === 'boolean'
            };
        });
    }

    get hasNoDisplayRows() {
        return this.displayRows.length === 0;
    }

    get hasSelectedRows() {
        return this.selectedRowIds.size > 0;
    }

    get hasNoSelectedRows() {
        return !this.hasSelectedRows;
    }

    get hasHiddenRows() {
        return this.hiddenRowCount > 0;
    }

    get hasNoHiddenRows() {
        return !this.hasHiddenRows;
    }

    get isNotLoading() {
        return !this.isLoading;
    }

    get isNotInlineEditMode() {
        return !this.isInlineEditMode;
    }

    get hiddenRowsMessage() {
        return `${this.hiddenRowCount} row${this.hiddenRowCount !== 1 ? 's' : ''} hidden`;
    }

    get selectAllChecked() {
        const rows = this.filteredRows;
        return rows.length > 0 && rows.every(row => this.selectedRowIds.has(row.Id));
    }

    get selectAllIndeterminate() {
        const rows = this.filteredRows;
        const selectedCount = rows.filter(row => this.selectedRowIds.has(row.Id)).length;
        return selectedCount > 0 && selectedCount < rows.length;
    }

    get inlineEditButtonLabel() {
        return this.isInlineEditMode ? 'Exit Edit Mode' : 'Inline Edit Mode';
    }

    get inlineEditButtonVariant() {
        return this.isInlineEditMode ? 'brand' : 'neutral';
    }

    get showSearchClear() {
        return this.searchTerm && this.searchTerm.length > 0;
    }

    get headerEditPicklistOptions() {
        if (!this.activeHeaderEditColumn) return [];
        const col = this.columnMetadataMap.get(this.activeHeaderEditColumn);
        return col ? col.picklistValues : [];
    }

    get totalRowCount() {
        return this.workingData.length;
    }

    get visibleRowCount() {
        return this.filteredRows.length;
    }

    get virtualScrollTopPadding() {
        if (!this.virtualScrollEnabled) return '0px';
        return `${this.visibleStartIndex * ROW_HEIGHT}px`;
    }

    get virtualScrollBottomPadding() {
        if (!this.virtualScrollEnabled) return '0px';
        const totalRows = this.filteredRows.length;
        return `${(totalRows - this.visibleEndIndex) * ROW_HEIGHT}px`;
    }

    // Format display values based on data type
    formatDisplayValue(value, dataType) {
        if (value === null || value === undefined) return '';

        switch (dataType) {
            case 'boolean':
                return value ? '✓' : '✗';
            case 'number':
                return typeof value === 'number' ? value.toLocaleString() : value;
            case 'date':
                if (!value) return '';
                const date = new Date(value);
                return date.toLocaleDateString();
            default:
                return String(value);
        }
    }

    // Virtual scroll handler
    handleTableScroll(event) {
        if (!this.virtualScrollEnabled) return;

        const container = event.target;
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VIRTUAL_SCROLL_BUFFER);
        const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT);
        const endIndex = Math.min(
            this.filteredRows.length,
            startIndex + visibleCount + (VIRTUAL_SCROLL_BUFFER * 2)
        );

        if (startIndex !== this.visibleStartIndex || endIndex !== this.visibleEndIndex) {
            this.visibleStartIndex = startIndex;
            this.visibleEndIndex = endIndex;
        }
    }

    // Event Handlers - Controls
    handleToggleInlineEdit() {
        this.isInlineEditMode = !this.isInlineEditMode;

        // Cancel any active header edit when toggling inline edit
        if (this.activeHeaderEditColumn) {
            this.cancelHeaderEdit();
        }
    }

    handleHideSelected() {
        if (this.selectedRowIds.size === 0) return;

        // Store checkbox states before hiding
        this.selectedRowIds.forEach(rowId => {
            this.hiddenRowCheckboxStates.set(rowId, true);
            this.hiddenRowIds.add(rowId);
            this.visibleRowIds.delete(rowId);
        });

        this.hiddenRowCount = this.hiddenRowIds.size;
        this.selectedRowIds.clear();
        this.selectedRowIds = new Set(this.selectedRowIds);
    }

    handleHideUnselected() {
        const rowsToHide = [];

        this.visibleRowIds.forEach(rowId => {
            if (!this.selectedRowIds.has(rowId)) {
                rowsToHide.push(rowId);
            }
        });

        // Store checkbox states and hide
        rowsToHide.forEach(rowId => {
            this.hiddenRowCheckboxStates.set(rowId, false);
            this.hiddenRowIds.add(rowId);
            this.visibleRowIds.delete(rowId);
        });

        // Store selected rows' states and clear selection
        this.selectedRowIds.forEach(rowId => {
            this.hiddenRowCheckboxStates.set(rowId, true);
        });

        this.hiddenRowCount = this.hiddenRowIds.size;
        this.selectedRowIds.clear();
        this.selectedRowIds = new Set(this.selectedRowIds);
    }

    handleUnhideAll() {
        // Restore all hidden rows
        this.hiddenRowIds.forEach(rowId => {
            this.visibleRowIds.add(rowId);

            // Restore checkbox state
            const wasSelected = this.hiddenRowCheckboxStates.get(rowId);
            if (wasSelected) {
                this.selectedRowIds.add(rowId);
            }
        });

        this.hiddenRowIds.clear();
        this.hiddenRowCheckboxStates.clear();
        this.hiddenRowCount = 0;
        this.searchTerm = '';

        // Trigger reactivity
        this.selectedRowIds = new Set(this.selectedRowIds);
        this.visibleRowIds = new Set(this.visibleRowIds);
    }

    handleSearchInput(event) {
        const value = event.target.value;

        // Debounce search
        if (this._searchDebounceTimer) {
            clearTimeout(this._searchDebounceTimer);
        }

        this._searchDebounceTimer = setTimeout(() => {
            this.searchTerm = value;
            // Reset virtual scroll position when searching
            if (this.virtualScrollEnabled) {
                this.visibleStartIndex = 0;
                this.visibleEndIndex = Math.min(50 + VIRTUAL_SCROLL_BUFFER, this.filteredRows.length);
            }
        }, SEARCH_DEBOUNCE_MS);
    }

    handleClearSearch() {
        this.searchTerm = '';
        const searchInput = this.template.querySelector('[data-id="search-input"]');
        if (searchInput) {
            searchInput.value = '';
        }
        // Reset virtual scroll position
        if (this.virtualScrollEnabled) {
            this.visibleStartIndex = 0;
            this.visibleEndIndex = Math.min(50 + VIRTUAL_SCROLL_BUFFER, this.filteredRows.length);
        }
    }

    // Event Handlers - Row Selection
    handleSelectAll(event) {
        const isChecked = event.target.checked;
        const rows = this.filteredRows;

        if (isChecked) {
            rows.forEach(row => this.selectedRowIds.add(row.Id));
        } else {
            rows.forEach(row => this.selectedRowIds.delete(row.Id));
        }

        this.selectedRowIds = new Set(this.selectedRowIds);
        this.fireRowsSelectedEvent();
    }

    handleRowSelect(event) {
        const rowId = event.currentTarget.dataset.rowId;
        const isChecked = event.target.checked;

        if (isChecked) {
            this.selectedRowIds.add(rowId);
        } else {
            this.selectedRowIds.delete(rowId);
        }

        this.selectedRowIds = new Set(this.selectedRowIds);
        this.fireRowsSelectedEvent();
    }

    // Event Handlers - Header Edit
    handleHeaderDoubleClick(event) {
        const fieldApi = event.currentTarget.dataset.fieldApi;
        this.activeHeaderEditColumn = fieldApi;

        const col = this.columnMetadataMap.get(fieldApi);
        if (col.dataType === 'boolean') {
            this.headerEditValue = false;
        } else {
            this.headerEditValue = '';
        }

        // Focus the input after render
        setTimeout(() => {
            const input = this.template.querySelector(`[data-header-input="${fieldApi}"]`);
            if (input) {
                input.focus();
            }
        }, 50);
    }

    handleHeaderEditChange(event) {
        const fieldApi = event.currentTarget.dataset.fieldApi;
        const col = this.columnMetadataMap.get(fieldApi);

        if (col.dataType === 'boolean') {
            this.headerEditValue = event.target.checked;
        } else {
            this.headerEditValue = event.target.value;
        }
    }

    handleHeaderEditApply(event) {
        const fieldApi = event.currentTarget.dataset.fieldApi || this.activeHeaderEditColumn;
        this.applyHeaderEdit(fieldApi);
    }

    handleHeaderEditKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.applyHeaderEdit(this.activeHeaderEditColumn);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelHeaderEdit();
        }
    }

    applyHeaderEdit(fieldApi) {
        if (!fieldApi || this.headerEditValue === null || this.headerEditValue === undefined) {
            this.cancelHeaderEdit();
            return;
        }

        const col = this.columnMetadataMap.get(fieldApi);
        let valueToApply = this.headerEditValue;

        // Type conversion
        if (col.dataType === 'number') {
            valueToApply = parseFloat(valueToApply) || 0;
        }

        // Determine which rows to update (use filteredRows to respect scoping)
        const currentVisibleRows = this.filteredRows;
        let rowsToUpdate;

        if (this.selectedRowIds.size > 0) {
            // Only update selected rows that are visible
            rowsToUpdate = currentVisibleRows.filter(row => this.selectedRowIds.has(row.Id));
        } else {
            // Update all visible rows
            rowsToUpdate = currentVisibleRows;
        }

        // Batch update for performance
        const updatedIds = [];
        rowsToUpdate.forEach(row => {
            const workingRow = this._workingDataMap.get(row.Id);
            if (workingRow) {
                const oldValue = workingRow[fieldApi];
                workingRow[fieldApi] = valueToApply;

                // Mark as edited
                this.editedCells.set(`${row.Id}_${fieldApi}`, true);
                updatedIds.push({ rowId: row.Id, oldValue, newValue: valueToApply });
            }
        });

        // Trigger reactivity
        this.workingData = [...this.workingData];
        this.editedCells = new Map(this.editedCells);

        // Fire batch data changed event
        updatedIds.forEach(({ rowId, oldValue, newValue }) => {
            this.fireDataChangedEvent(rowId, fieldApi, oldValue, newValue);
        });

        this.cancelHeaderEdit();
    }

    cancelHeaderEdit() {
        this.activeHeaderEditColumn = null;
        this.headerEditValue = null;
    }

    handleHeaderEditCancel() {
        this.cancelHeaderEdit();
    }

    // Event Handlers - Cell Edit
    handleCellChange(event) {
        const rowId = event.currentTarget.dataset.rowId;
        const fieldApi = event.currentTarget.dataset.fieldApi;
        const col = this.columnMetadataMap.get(fieldApi);

        let newValue;
        if (col.dataType === 'boolean') {
            newValue = event.target.checked;
        } else {
            newValue = event.target.value;

            // Type conversion
            if (col.dataType === 'number') {
                newValue = parseFloat(newValue) || 0;
            }
        }

        // Update working data using map for O(1) lookup
        const row = this._workingDataMap.get(rowId);
        if (row) {
            const oldValue = row[fieldApi];
            row[fieldApi] = newValue;

            // Mark as edited
            this.editedCells.set(`${rowId}_${fieldApi}`, true);

            // Fire data changed event
            this.fireDataChangedEvent(rowId, fieldApi, oldValue, newValue);

            // Trigger reactivity
            this.workingData = [...this.workingData];
            this.editedCells = new Map(this.editedCells);
        }
    }

    // Keyboard navigation
    handleCellKeydown(event) {
        const rowId = event.currentTarget.dataset.rowId;
        const fieldApi = event.currentTarget.dataset.fieldApi;

        if (event.key === 'Enter') {
            event.preventDefault();
            this.navigateToNextRow(rowId, fieldApi);
        } else if (event.key === 'Tab') {
            // Let Tab naturally flow, but track focus
            setTimeout(() => {
                const focused = this.template.activeElement;
                if (focused && focused.dataset) {
                    this._focusedCellKey = `${focused.dataset.rowId}_${focused.dataset.fieldApi}`;
                }
            }, 0);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.navigateToNextRow(rowId, fieldApi);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.navigateToPreviousRow(rowId, fieldApi);
        }
    }

    navigateToNextRow(currentRowId, fieldApi) {
        const visibleRows = this.displayRows;
        const currentIndex = visibleRows.findIndex(r => r.Id === currentRowId);

        if (currentIndex < visibleRows.length - 1) {
            const nextRowId = visibleRows[currentIndex + 1].Id;
            const nextInput = this.template.querySelector(
                `[data-row-id="${nextRowId}"][data-field-api="${fieldApi}"]`
            );
            if (nextInput) {
                nextInput.focus();
            }
        }
    }

    navigateToPreviousRow(currentRowId, fieldApi) {
        const visibleRows = this.displayRows;
        const currentIndex = visibleRows.findIndex(r => r.Id === currentRowId);

        if (currentIndex > 0) {
            const prevRowId = visibleRows[currentIndex - 1].Id;
            const prevInput = this.template.querySelector(
                `[data-row-id="${prevRowId}"][data-field-api="${fieldApi}"]`
            );
            if (prevInput) {
                prevInput.focus();
            }
        }
    }

    // Custom Events
    fireDataChangedEvent(rowId, fieldApi, oldValue, newValue) {
        this.dispatchEvent(new CustomEvent('datachanged', {
            detail: {
                rowId,
                fieldApi,
                oldValue,
                newValue
            },
            bubbles: true,
            composed: true
        }));
    }

    fireRowsSelectedEvent() {
        this.dispatchEvent(new CustomEvent('rowsselected', {
            detail: {
                selectedIds: Array.from(this.selectedRowIds)
            },
            bubbles: true,
            composed: true
        }));
    }

    // Utility to get table CSS classes
    get tableClasses() {
        return 'slds-table slds-table_bordered slds-table_cell-buffer excel-table';
    }
}
