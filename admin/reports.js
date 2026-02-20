/**
 * Reports Generation with Supabase
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth('admin');
    if (!user) return;
    
    const displayEl = document.getElementById('displayUserName');
    if (displayEl) displayEl.textContent = user.full_name;
    
    // Set default dates
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    if (startDateInput) startDateInput.value = lastMonth.toISOString().split('T')[0];
    if (endDateInput) endDateInput.value = today.toISOString().split('T')[0];
});

/**
 * Show and clear the report container
 */
function prepareReportContainer() {
    const container = document.getElementById('report-container');
    if (container) {
        container.innerHTML = '<div class="loading-spinner">Generating report...</div>';
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    }
}

async function generateInventoryReport() {
    showToast('Analyzing inventory data...', 'info');
    prepareReportContainer();
    
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    
    const { data, error } = await supabaseApi.getInventoryReport(startDate, endDate);
    
    if (error) {
        console.error('Error generating report:', error);
        showToast('Failed to generate inventory report', 'error');
        document.getElementById('report-container').style.display = 'none';
        return;
    }
    
    displayInventoryReport(data);
    showToast('Inventory report generated', 'success');
}

function displayInventoryReport(data) {
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer) return;
    
    reportContainer.innerHTML = `
        <div class="report-summary">
            <h3>Inventory Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Items</span>
                    <span class="value">${data.totalItems}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Quantity</span>
                    <span class="value">${data.totalValue}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Low Stock items</span>
                    <span class="value">${data.lowStockCount}</span>
                </div>
            </div>
        </div>
        
        <div class="report-table">
            <h3>Inventory Details</h3>
            <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Condition</th>
                        <th>Department</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                        <tr>
                            <td>${item.item_name}</td>
                            <td>${item.category}</td>
                            <td>${item.quantity}</td>
                            <td><span class="condition-badge ${item.condition?.toLowerCase() || 'good'}">${item.condition || 'Good'}</span></td>
                            <td>${item.department || item.location || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        </div>
    `;
}

async function generateStockMovementReport() {
    showToast('Fetching movement logs...', 'info');
    prepareReportContainer();
    
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    
    const { data, error } = await supabaseApi.getStockMovementReport(startDate, endDate);
    
    if (error) {
        console.error('Error generating report:', error);
        showToast('Failed to generate stock movement report', 'error');
        document.getElementById('report-container').style.display = 'none';
        return;
    }
    
    displayStockMovementReport(data);
    showToast('Movement report generated', 'success');
}

function displayStockMovementReport(data) {
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer) return;
    
    reportContainer.innerHTML = `
        <div class="report-summary">
            <h3>Stock Movement Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Movements</span>
                    <span class="value">${data.totalMovements}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total In</span>
                    <span class="value">${data.inMovements}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Total Out</span>
                    <span class="value">${data.outMovements}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Adjustments</span>
                    <span class="value">${data.adjustments}</span>
                </div>
            </div>
        </div>
        
        <div class="report-table">
            <h3>Movement Details</h3>
            <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>User</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.movements.map(movement => `
                        <tr>
                            <td>${new Date(movement.created_at).toLocaleDateString()}</td>
                            <td>${movement.inventory_items?.item_name || 'Unknown'}</td>
                            <td><span class="badge ${movement.movement_type === 'in' ? 'badge-success' : movement.movement_type === 'out' ? 'badge-danger' : 'badge-warning'}">${movement.movement_type.toUpperCase()}</span></td>
                            <td>${movement.quantity}</td>
                            <td>${movement.users?.full_name || 'System'}</td>
                            <td>${movement.reason || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        </div>
    `;
}

async function generateLowStockReport() {
    showToast('Checking for low stock...', 'warning');
    prepareReportContainer();
    
    const { data, error } = await supabaseApi.getLowStockItems();
    
    if (error) {
        console.error('Error generating report:', error);
        showToast('Failed to check low stock', 'error');
        document.getElementById('report-container').style.display = 'none';
        return;
    }
    
    displayLowStockReport(data);
    showToast('Low stock assessment complete', 'success');
}

function displayLowStockReport(items) {
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer) return;
    
    reportContainer.innerHTML = `
        <div class="report-summary">
            <h3>Low Stock Alert Report</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Items Below Threshold</span>
                    <span class="value" style="color: #e53e3e;">${items.length}</span>
                </div>
            </div>
        </div>
        
        <div class="report-table">
            <h3>Critical Items</h3>
            <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Item Name</th>
                        <th>Current Qty</th>
                        <th>Min Level</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.item_name}</td>
                            <td style="color: #e53e3e; font-weight: bold;">${item.quantity}</td>
                            <td>${item.min_stock_level}</td>
                            <td><span class="badge badge-danger">REORDER</span></td>
                        </tr>
                    `).join('')}
                    ${items.length === 0 ? '<tr><td colspan="4">All stock levels are healthy!</td></tr>' : ''}
                </tbody>
            </table>
            </div>
        </div>
    `;
}

async function generateUsageTrendsReport() {
    showToast('Calculating usage trends...', 'info');
    prepareReportContainer();
    
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    
    const { data, error } = await supabaseApi.getStockMovements({ startDate, endDate, movementType: 'out' });
    
    if (error) {
        console.error('Error generating report:', error);
        showToast('Failed to calculate usage trends', 'error');
        document.getElementById('report-container').style.display = 'none';
        return;
    }

    // Process trends
    const trends = {};
    data.forEach(m => {
        const itemName = m.inventory_items?.item_name || 'Unknown';
        trends[itemName] = (trends[itemName] || 0) + m.quantity;
    });

    const sortedTrends = Object.entries(trends)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    displayUsageTrendsReport(sortedTrends);
    showToast('Usage trends calculated', 'success');
}

function displayUsageTrendsReport(trends) {
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer) return;
    
    reportContainer.innerHTML = `
        <div class="report-summary">
            <h3>Usage Trends (Top 10 Most Issued Items)</h3>
        </div>
        
        <div class="report-table">
            <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Item Name</th>
                        <th>Total Issued</th>
                        <th>Velocity</th>
                    </tr>
                </thead>
                <tbody>
                    ${trends.map(([name, qty]) => `
                        <tr>
                            <td>${name}</td>
                            <td><strong>${qty}</strong></td>
                            <td>
                                <div style="width: 100%; background: #edf2f7; height: 8px; border-radius: 4px;">
                                    <div style="width: ${Math.min(100, (qty / trends[0][1]) * 100)}%; background: #a142f4; height: 100%; border-radius: 4px;"></div>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                    ${trends.length === 0 ? '<tr><td colspan="3">No usage data for selected period.</td></tr>' : ''}
                </tbody>
            </table>
            </div>
        </div>
    `;
}

async function generateRequestLogReport() {
    showToast('Loading request history...', 'info');
    prepareReportContainer();
    
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;
    
    const { data, error } = await supabaseApi.getRequestReport(startDate, endDate);
    
    if (error) {
        console.error('Error generating report:', error);
        showToast('Failed to load request history', 'error');
        document.getElementById('report-container').style.display = 'none';
        return;
    }
    
    displayRequestReport(data);
    showToast('Request log loaded', 'success');
}

function displayRequestReport(data) {
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer) return;
    
    reportContainer.innerHTML = `
        <div class="report-summary">
            <h3>Request History Report</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Total Requests</span>
                    <span class="value">${data.totalRequests}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Fulfilled</span>
                    <span class="value" style="color: #34a853;">${data.fulfilled}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Pending</span>
                    <span class="value" style="color: #fbbc05;">${data.pending}</span>
                </div>
            </div>
        </div>
        
        <div class="report-table">
            <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.requests.map(request => `
                        <tr>
                            <td>${new Date(request.created_at).toLocaleDateString()}</td>
                            <td>${request.users?.full_name || 'Unknown'}</td>
                            <td>${request.inventory_items?.item_name || 'Unknown'}</td>
                            <td>${request.quantity}</td>
                            <td><span class="status-badge status-${request.status}">${request.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        </div>
    `;
}

/**
 * Helper: Export Data to Excel
 */
function exportToExcel(data, fileName, title, headerType = 'table') {
    if (typeof XLSX === 'undefined') {
        showToast('Excel library not loaded. Please check your internet connection.', 'error');
        return;
    }

    // 1. Prepare Data with Header
    // Row 1: "KNS INVENTORY" (Merged later? or just put in first cell)
    // Row 2: Title
    // Row 3: Empty
    // Row 4+: Data Headers/Content
    
    const wsData = [
        ['KNS INVENTORY SYSTEM'], // A1
        [title.toUpperCase()],    // A2
        ['Generated: ' + new Date().toLocaleString()], // A3
        [''] // Spacer
    ];

    // Append actual data
    // data should be an array of arrays
    wsData.push(...data);

    // 2. Create Sheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 3. Set Column Widths (Auto-fit simple estimation)
    // Calculate max width per column
    const colWidths = [];
    wsData.forEach(row => {
        row.forEach((cell, i) => {
            const len = (cell ? String(cell).length : 0);
            colWidths[i] = Math.max(colWidths[i] || 0, len);
        });
    });

    // Add some padding and set wch
    ws['!cols'] = colWidths.map(w => ({ wch: w + 5 }));

    // 4. Create Workbook and Export
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, fileName);
}

/**
 * Export current displayed report to Excel
 */
function exportReport() {
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer || reportContainer.style.display === 'none') {
        showToast('No report to export. Generate one first.', 'warning');
        return;
    }
    
    const table = reportContainer.querySelector('table');
    if (!table) {
        showToast('No tabular data found in report.', 'warning');
        return;
    }
    
    // Extract Table Data
    const tableData = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const rowData = [];
        row.querySelectorAll('th, td').forEach(cell => {
            // Remove badges text duplication if any? innerText is usually fine.
            rowData.push(cell.innerText);
        });
        tableData.push(rowData);
    });

    // Get Report Title
    const title = reportContainer.querySelector('h3')?.innerText || 'Report';

    exportToExcel(tableData, `Report_${new Date().getTime()}.xlsx`, title);
    showToast('Report exported as Excel', 'success');
}

/**
 * General data export (Full Inventory)
 */
async function exportData() {
    showToast('Preparing full data export...', 'info');
    const { data, error } = await supabaseApi.getInventoryItems();
    
    if (error) {
        showToast('Export failed', 'error');
        return;
    }

    const headers = ['ID', 'Item Name', 'Category', 'Department', 'Quantity', 'Min Stock', 'Unit Price', 'Condition', 'Status', 'Created At'];
    const dbKeys = ['id', 'item_name', 'category', 'department', 'quantity', 'min_stock_level', 'unit_price', 'condition', 'status', 'created_at'];

    // Map data to array of arrays
    const sheetData = [headers];
    data.forEach(item => {
        const row = dbKeys.map(key => item[key] || '');
        sheetData.push(row);
    });

    exportToExcel(sheetData, `Full_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`, 'FULL INVENTORY EXPORT');
    showToast('Full inventory exported', 'success');
}
