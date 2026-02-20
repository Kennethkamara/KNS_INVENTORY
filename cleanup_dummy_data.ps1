-- Script to clean all dummy data from HTML files
-- Run this PowerShell script to remove all hardcoded table rows

$files = @(
    @{
        path = 'user\myinventory.html'
        start = 103
        end = 180
        replacement = '                        <tbody id="inventory-list">
                            <!-- Data will be loaded from Supabase -->
                        </tbody>'
    },
    @{
        path = 'user\myrequests.html'
        start = 105
        end = 133
        replacement = '                        <tbody id="requests-list">
                            <!-- Data will be loaded from Supabase -->
                        </tbody>'
    },
    @{
        path = 'user\index.html - Assigned Items'
        start = 97
        end = 113
        replacement = '                            <tbody id="assigned-items-list">
                                <!-- Data will be loaded from Supabase -->
                            </tbody>'
    },
    @{
        path = 'user\index.html - Recent Requests'
        start = 129
        end = 145
        replacement = '                            <tbody id="recent-requests-list">
                                <!-- Data will be loaded from Supabase -->
                            </tbody>'
    }
)

Write-Host "Clean these files manually or use find/replace to remove dummy <tr> rows"
$files | ForEach-Object {
    Write-Host "File: $($_.path) - Lines $($_.start) to $($_.end)"
}
