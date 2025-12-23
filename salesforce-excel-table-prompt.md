# Salesforce LWC Excel-Like Table Component - Development Prompt

## Project Overview
Build a custom Lightning Web Component (LWC) that provides an Excel-like editable table interface with advanced filtering, scoping, and bulk editing capabilities. The component must be built entirely from scratch without relying on standard Salesforce table components or external libraries.

## Core Requirements

### Component Architecture
- **Technology Stack**: Pure LWC + Apex (backend queries only)
- **Styling**: Salesforce Lightning Design System (SLDS) 2.0
- **Standard Components**: Use where possible, but create custom implementations if standard components impose technical limitations
- **Data Management**: 
  - Copy and store the original dataset in-memory upon initialization
  - Do NOT implement DML save operations (developers will handle this via Apex)
  - Maintain state for all filtering, scoping, and editing operations in JavaScript
- **Performance Target**: Optimized for 200 rows, must stress test up to 1000+ rows

### Data State Management
The component must maintain several data states:
1. **Original dataset** (immutable copy from initialization)
2. **Current working dataset** (reflects all edits)
3. **Visible rows** (after applying row-scoping and search filters)
4. **Hidden rows state** (tracks which rows are hidden and their checkbox states)
5. **Selection state** (which checkboxes are marked)
6. **Column metadata** (data types, picklist values, API names)

## Data Type Support

### Supported Data Types
The table must support the following Salesforce field types:
- **Text**: String input fields
- **Number**: Numeric input fields (integer/decimal)
- **Picklist**: Dropdown selection with predefined values
- **Date**: Date picker input
- **Boolean**: Checkbox input

All other data types are out of scope.

### Column Metadata Structure
Apex controller must provide column metadata alongside the data:

```json
{ 
  "data-types": [
    { 
      "object_api": "Custom_Object__c", 
      "field_api": "Custom_Field__c", 
      "data-type": "picklist", 
      "values": "'value 1','value 2'" 
    },
    { 
      "object_api": "Custom_Object__c", 
      "field_api": "Name", 
      "data-type": "text", 
      "values": null 
    },
    { 
      "object_api": "Custom_Object__c", 
      "field_api": "Amount__c", 
      "data-type": "number", 
      "values": null 
    },
    { 
      "object_api": "Custom_Object__c", 
      "field_api": "Start_Date__c", 
      "data-type": "date", 
      "values": null 
    },
    { 
      "object_api": "Custom_Object__c", 
      "field_api": "Is_Active__c", 
      "data-type": "boolean", 
      "values": null 
    }
  ]
}
```

**Important**: 
- Each column must be associated with its data type
- Picklist fields include comma-separated values in the `values` property
- The component must render appropriate input types based on `data-type`
- No server-side Salesforce field validation (e.g., required fields, field-level security) should be enforced—only client-side data type validation

## Feature Requirements

### 1. Inline Editing Mode
- **Trigger**: Button labeled "Inline Edit Mode" above the table
- **Behavior**: 
  - Converts all visible cells into editable input fields based on their data type:
    - **Text**: `<input type="text">`
    - **Number**: `<input type="number">`
    - **Picklist**: `<select>` dropdown with values from metadata
    - **Date**: `<input type="date">` or `<lightning-input type="date">`
    - **Boolean**: `<input type="checkbox">`
  - Toggle on/off to switch between view and edit modes
  - When toggled off, cells return to read-only display mode

### 2. Column Header Editing Mode
- **Trigger**: Double-click any column header
- **UI Changes**:
  - Column header becomes an input field matching the column's data type
  - Small "✔️" (checkmark) button appears to the right of the input
  - For picklists: show dropdown with available values
  - For booleans: show checkbox
  - For dates: show date picker
- **Scope Rules**:
  - If ANY row checkboxes are selected: only modify selected rows
  - If NO row checkboxes are selected: modify ALL visible rows (respecting row-scoping)
- **Critical Rule**: Must respect row-scoping (hidden rows should NEVER be modified)
- **Behavior**: Clicking the checkmark applies the entered value to all in-scope rows for that column

### 3. Row Selection (Checkboxes)
- **Location**: First column of each row
- **Behavior**:
  - Allow multi-row selection
  - Selection state must be preserved when hiding/unhiding rows
  - When used with column header editing: defines the scope of bulk edits
  - Sub-scoping concept: checkbox selections within already scoped (filtered) rows create a narrower scope

### 4. Row-Scoping (Hide/Show Controls)
Implement three buttons above the table:

#### Button 1: "Hide Unselected"
- Hides all rows where checkbox is NOT marked
- Clears all checkbox selections after hiding
- Hidden rows remain in memory with their data and previous checkbox state

#### Button 2: "Hide Selected"  
- Hides all rows where checkbox IS marked
- Clears all checkbox selections after hiding
- Hidden rows remain in memory with their data and previous checkbox state

#### Button 3: "Unhide All"
- Restores all hidden rows to visible state
- Restores checkbox states to their values from before hiding occurred
- Clears any active search filters

**Critical Rule**: Row-scoping must cascade through all operations:
- Column header editing must NOT affect hidden rows
- Search filtering must NOT reveal hidden rows
- Checkbox selections can only occur on visible rows

### 5. Search/Filter Field
- **Location**: Above the table (in the controls section)
- **Behavior**:
  - Real-time filtering as user types
  - **Case-insensitive** search across all columns
  - Searches within all text-based column values (text, picklist labels, formatted numbers/dates)
  - Must respect row-scoping: hidden rows stay hidden regardless of search match
  - Checkbox selections within search results create sub-sub-scoping for column header edits
  - Clearing search field restores visible rows (but still respects row-scoping)

### 6. Keyboard Navigation
The component must support keyboard navigation:
- **Tab**: Move between cells in inline edit mode
- **Enter**: 
  - In inline edit mode: move to next row, same column
  - In column header edit mode: apply the value (same as clicking ✔️)
- **Arrow Keys**: Navigate between cells (optional enhancement)
- **Escape**: Cancel column header edit mode without applying changes

## Technical Implementation Guidelines

### State Management Strategy
```
Hierarchy of Scoping (most restrictive wins):
1. Original dataset (all rows)
2. Row-scoping (hide selected/unselected)
3. Search filter (text-based filtering)
4. Checkbox selection (for column header edits)
```

### Component Structure Recommendations
Consider creating these sub-components or internal modules:

#### Main Component: `excelLikeTable`
- Orchestrates all child components
- Manages all data states
- Exposes public API for parent components

#### Sub-components/Modules:
- **Table Controls Bar**: Houses all buttons and search field
- **Table Header**: Manages column headers with double-click edit functionality
- **Table Body**: Renders rows with inline editing capability
- **Table Row**: Individual row with checkbox and cells
- **Editable Cell**: Handles inline editing for individual cells based on data type

### Data Flow
1. **Initialization**: 
   - Apex query returns data + column metadata
   - Deep copy to `originalData` and `workingData`
   - Parse column metadata and store data type mappings
2. **User Edits**: 
   - Modify `workingData` only
   - Track which cells have been edited for visual indicators
3. **Row-Scoping**: 
   - Update `visibleRows` array
   - Store hidden rows separately with their state
4. **Search**: 
   - Further filter `visibleRows` without touching hidden rows
   - Case-insensitive string matching
5. **Export/Save**: 
   - Parent component accesses `workingData` for DML operations
   - Component can expose a `getModifiedRows()` method

### Event Handling
The component should expose custom events for:
- `datachanged`: Fires when any cell value is modified (includes row ID, field API, old value, new value)
- `rowsselected`: Fires when checkbox selection changes
- `saveready`: Indicates user wants to save changes (optional, for future integration)

### Input Type Mapping
Based on data type metadata, render appropriate inputs:

| Data Type | View Mode | Inline Edit Mode | Column Header Edit |
|-----------|-----------|------------------|-------------------|
| Text | Plain text | `<input type="text">` | `<input type="text">` |
| Number | Formatted number | `<input type="number">` | `<input type="number">` |
| Picklist | Label value | `<select>` with options | `<select>` with options |
| Date | Formatted date | Date picker | Date picker |
| Boolean | ✓ or ✗ icon | `<input type="checkbox">` | `<input type="checkbox">` |

## UI/UX Considerations

### Layout Structure
```
┌────────────────────────────────────────────────────────────────┐
│  [Inline Edit Mode] [Hide Selected] [Hide Unselected]          │
│  [Unhide All]       [Search: ___________________________]      │
├────────────────────────────────────────────────────────────────┤
│  [☐] Name(text)  Amount(num)  Status(pick)  Date  Active(bool)│
├────────────────────────────────────────────────────────────────┤
│  [☐] Record 1    100.00       Open          1/1/25    ☑        │
│  [☐] Record 2    250.50       Closed        2/1/25    ☐        │
│  [☐] Record 3    75.25        Open          3/1/25    ☑        │
└────────────────────────────────────────────────────────────────┘
```

### SLDS Styling Notes
- Use `slds-table` classes for base structure
- Apply `slds-is-edited` for modified cells (visual indicator)
- Use `slds-assistive-text` for accessibility labels
- Implement `slds-has-focus` states for keyboard navigation
- Use `slds-col-actions` for column header interactions
- Apply `slds-is-sortable` class to indicate double-click capability on headers

### Visual Indicators
- **Edited cells**: Apply distinct background color or border (e.g., light yellow)
- **Column header edit mode**: Highlight active column
- **Hidden rows**: Show count of hidden rows in controls bar
- **Search active**: Show "X" button to clear search
- **Loading state**: Show spinner during initial data load

## Constraints & Limitations
- ❌ No external JavaScript libraries (jQuery, Lodash, etc.)
- ❌ No extending `lightning-datatable`
- ❌ No direct DML operations in LWC
- ❌ No Salesforce field validation (required fields, FLS, validation rules)
- ✅ Can use standard LWC base components (`lightning-input`, `lightning-button`, `lightning-combobox`, etc.) if they don't impose limitations
- ✅ Must build custom implementations when standard components block requirements
- ✅ Client-side data type validation only (e.g., ensure number fields receive numbers)

## Apex Controller Contract

### Expected Method Signature
```apex
@AuraEnabled(cacheable=true)
public static String getTableData(String recordId) {
    // Returns JSON with structure:
    // {
    //   "columns": [...],  // Column metadata with data types
    //   "rows": [...]      // Actual record data
    // }
}
```

### Expected Response Structure
```json
{
  "columns": [
    {
      "object_api": "Custom_Object__c",
      "field_api": "Name",
      "label": "Name",
      "data-type": "text",
      "values": null
    },
    {
      "object_api": "Custom_Object__c",
      "field_api": "Status__c",
      "label": "Status",
      "data-type": "picklist",
      "values": "'Open','In Progress','Closed'"
    }
  ],
  "rows": [
    {
      "Id": "a001234567890ABC",
      "Name": "Record 1",
      "Status__c": "Open"
    }
  ]
}
```

## Performance Considerations
- **Initial Target**: 200 rows with smooth interaction
- **Stress Test**: Must handle 1000+ rows without significant lag
- **Optimization Techniques**:
  - Use virtual scrolling if row count exceeds 500
  - Debounce search input (e.g., 300ms delay)
  - Minimize DOM manipulations by batch updating
  - Use `track` and `api` decorators efficiently
  - Consider pagination if performance degrades beyond 1000 rows

## Success Criteria
- [ ] All editing modes work independently and in combination
- [ ] Row-scoping correctly restricts all operations
- [ ] Search filtering respects hidden rows and is case-insensitive
- [ ] Checkbox selections properly scope column header edits
- [ ] Original data remains unmodified in memory
- [ ] Component exposes edited data to parent components
- [ ] No dependency on standard Salesforce table components
- [ ] Follows SLDS 2.0 styling guidelines
- [ ] All 5 data types render with appropriate input controls
- [ ] Column header editing respects data types
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Performs well with 200 rows, acceptable performance at 1000+ rows
- [ ] Visual indicators for edited cells
- [ ] Accessibility standards met (ARIA labels, keyboard support)

---

## Implementation Approach
1. Start with basic table rendering and data structure
2. Implement inline edit mode with data type support
3. Add row selection (checkboxes)
4. Implement row-scoping (hide/unhide functionality)
5. Add search/filter functionality
6. Implement column header editing mode
7. Add keyboard navigation
8. Optimize for performance
9. Polish UI/UX and accessibility

**Note**: The component should be designed for reusability—allow parent components to pass in data and column metadata via public properties.
