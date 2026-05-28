# Requirements Document

## Introduction

The Expense & Budget Visualizer is a single-page web application that allows users to track personal expenses, categorize spending, and visualize their budget distribution through an interactive pie chart. The app runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, persisting data via the Local Storage API. It is designed to be simple, clean, and beginner-friendly with a responsive, mobile-first layout.

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single expense entry consisting of an item name, amount, and category.
- **Transaction_List**: The scrollable UI component that displays all recorded transactions.
- **Input_Form**: The HTML form used to enter new transaction data.
- **Validator**: The client-side validation logic that checks form inputs before submission.
- **Storage**: The browser's Local Storage API used to persist transaction data.
- **Chart**: The Chart.js-powered pie chart that visualizes spending distribution by category.
- **Balance_Display**: The UI element that shows the total amount spent across all transactions.
- **Category**: One of three predefined spending labels — Food, Transport, or Fun.
- **Theme_Toggle**: The UI control that switches the app between dark and light visual modes.
- **Sort_Control**: The UI control that changes the display order of transactions in the Transaction_List.
- **Budget_Limit**: A configurable per-category spending threshold used to highlight overspending.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to enter expense details through a form, so that I can record my spending quickly and accurately.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for item name (maximum 100 characters), a numeric field for amount (accepting values from 0.01 to 999,999,999.99), and a dropdown selector for Category with options Food, Transport, and Fun.
2. THE Input_Form SHALL contain a submit button labeled "Add Transaction".
3. WHEN the user submits the Input_Form with an empty item name field, THE Validator SHALL display an inline error message indicating the item name is required.
4. WHEN the user submits the Input_Form with an amount field that is empty, zero, negative, or outside the range 0.01–999,999,999.99, THE Validator SHALL display an inline error message indicating a valid positive amount is required.
5. WHEN the user submits the Input_Form with no Category selected, THE Validator SHALL display an inline error message indicating a category must be selected.
6. WHEN all Input_Form fields pass validation, THE App SHALL create a new Transaction and add it to the Transaction_List.
7. WHEN a Transaction is successfully added, THE Input_Form SHALL reset the item name and amount fields to empty and the Category dropdown to its unselected placeholder state.
8. WHEN the Validator displays an inline error message, THE App SHALL render that message directly below the field that failed validation.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review and manage my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each Transaction with its item name, amount formatted with a currency symbol and exactly two decimal places (e.g., $12.50), and Category label.
2. WHILE the number of transactions exceeds the visible area, THE Transaction_List SHALL be scrollable and no other page sections SHALL shift position or change size as a result.
3. WHEN a Transaction is added or deleted, THE Transaction_List SHALL update to reflect the current state within 300 milliseconds.
4. WHEN the Transaction_List contains no transactions, THE App SHALL display a placeholder message indicating no transactions have been recorded.
5. WHEN the effective transaction count is zero due to filtering, THE App SHALL display a placeholder message indicating no transactions match the current filter.
6. THE Transaction_List SHALL display a delete button for each Transaction.
7. WHEN the user clicks the delete button for a Transaction, THE App SHALL remove that Transaction from the Transaction_List and from Storage without requiring additional confirmation.
8. WHEN a Storage deletion operation fails, THE App SHALL display an error message to the user and retain the Transaction in the Transaction_List.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending updated automatically, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all Transaction amounts formatted with a currency symbol, exactly two decimal places, and a thousands separator (e.g., $1,234.56).
2. WHEN a Transaction is added, THE Balance_Display SHALL recalculate and update the displayed total within 500 milliseconds.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL recalculate and update the displayed total within 500 milliseconds.
4. WHEN the Transaction_List is empty, THE Balance_Display SHALL display a total of zero formatted as currency (e.g., $0.00).
5. WHEN a Transaction is edited, THE Balance_Display SHALL recalculate and update the displayed total within 500 milliseconds.

---

### Requirement 4: Spending Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart using the Chart.js library showing the proportion of total spending for each Category, counting only expense-type transactions.
2. WHEN a Transaction is added, THE Chart SHALL update to reflect the new spending distribution within 500 milliseconds.
3. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the revised spending distribution within 500 milliseconds.
4. WHEN the Transaction_List is empty, THE Chart SHALL display a greyed-out placeholder state with a visible label indicating no data is available.
5. THE Chart SHALL assign a distinct, consistent color to each Category (Food, Transport, Fun) and SHALL exclude from the chart any Category whose total spending is zero.
6. THE Chart SHALL display a legend where each entry shows a color swatch, the Category name, and the percentage of total spending for that Category.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my spending history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE Storage SHALL save the updated transaction list to Local Storage.
2. WHEN a Transaction is deleted, THE Storage SHALL save the updated transaction list to Local Storage.
3. WHEN the App initializes, THE App SHALL read all previously saved transactions from Storage and render them in the Transaction_List.
4. WHEN the App initializes with no data in Storage, THE App SHALL render an empty Transaction_List and a zero Balance_Display.
5. WHEN the App initializes with Storage data that results in a zero total balance, THE App SHALL render all stored transactions in the Transaction_List and display a zero Balance_Display.
6. WHEN a Storage write operation fails, THE App SHALL display an error message to the user and retain the transaction in the in-memory state without crashing.
7. WHEN the App initializes and Storage contains malformed or unreadable data, THE App SHALL discard the corrupted data, render an empty Transaction_List, and display a zero Balance_Display.

---

### Requirement 6: Responsive Layout

**User Story:** As a user, I want the app to work well on both desktop and mobile screens, so that I can track expenses from any device.

#### Acceptance Criteria

1. THE App SHALL use a single CSS file for all styling.
2. THE App SHALL use a single JavaScript file for all behavior.
3. WHEN the viewport width is 600px or less, THE App SHALL stack the Input_Form, Balance_Display, Transaction_List, and Chart vertically in a single-column layout.
4. WHEN the viewport width is greater than 600px, THE App SHALL arrange the Input_Form and Transaction_List side by side in a two-column row, with the Chart and Balance_Display rendered in a separate row below.
5. WHEN the viewport width is 600px or less, THE App SHALL render all buttons, input fields, and select controls at a minimum tap target size of 44×44 CSS pixels.

---

### Requirement 7: Dark / Light Mode Toggle (Optional Feature)

**User Story:** As a user, I want to switch between dark and light themes, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. WHERE the Theme_Toggle is present, THE App SHALL display a toggle control (button or switch) to switch between dark and light modes.
2. WHEN the user activates the Theme_Toggle, THE App SHALL apply the selected theme to all visible backgrounds, text, icons, and input controls within 100 milliseconds.
3. WHEN the user activates the Theme_Toggle, THE Storage SHALL persist the selected theme preference; IF the Storage write fails, THEN THE App SHALL retain the selected theme for the current session without crashing.
4. WHEN the App initializes, THE App SHALL apply the previously saved theme preference from Storage; IF no preference is stored or the stored value is unrecognized or corrupted, THEN THE App SHALL default to light mode.

---

### Requirement 8: Sort Transactions (Optional Feature)

**User Story:** As a user, I want to sort my transaction list, so that I can find and review entries more easily.

#### Acceptance Criteria

1. WHERE the Sort_Control is present, THE App SHALL always display the sort control allowing the user to sort transactions by date added (newest first, oldest first) or by amount (highest first, lowest first), with the default sort order being date added newest first on initial render.
2. WHEN the user changes the Sort_Control selection, THE Transaction_List SHALL re-render in the selected order within 100 milliseconds.
3. WHEN a new Transaction is added, THE Transaction_List SHALL maintain the currently selected sort order.
4. WHEN two or more Transactions have equal sort values, THE Transaction_List SHALL preserve their original insertion order as the tie-breaking rule.

---

### Requirement 9: Budget Limit Highlight (Optional Feature)

**User Story:** As a user, I want to be alerted when my spending in a category exceeds a set limit, so that I can stay within my budget.

#### Acceptance Criteria

1. WHERE the Budget_Limit feature is present, THE App SHALL allow the user to set a numeric spending limit for each Category, accepting values in the range 0.01–999,999,999.99.
2. WHEN the total spending for a Category exceeds its Budget_Limit, THE App SHALL apply a persistent warning indicator (a distinct warning color or icon) to all of that Category's transactions in the Transaction_List.
3. WHEN the total spending for a Category exceeds its Budget_Limit, THE Chart SHALL apply a persistent warning indicator (a distinct warning color or border) to that Category's segment.
4. WHEN a Transaction is deleted and the Category total falls at or below the Budget_Limit within 1 second, THE App SHALL remove the warning indicator from that Category's transactions and Chart segment; WHEN a Budget_Limit for a Category is removed, THE App SHALL also remove the warning indicator for that Category immediately.
5. WHEN the user enters an invalid Budget_Limit value (empty, non-numeric, zero, negative, or out of range), THE App SHALL display an inline error message and SHALL NOT update the Budget_Limit.
