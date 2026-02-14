$files = @(
    'src\renderer\main\index.html',
    'src\renderer\sales\index.html',
    'src\renderer\reports\index.html',
    'src\renderer\settings\index.html',
    'src\renderer\products\index.html',
    'src\renderer\customers\index.html',
    'src\renderer\invoices\index.html',
    'src\renderer\quotations\index.html',
    'src\renderer\users\index.html',
    'src\renderer\suppliers\index.html',
    'src\renderer\purchases\index.html',
    'src\renderer\employees\index.html',
    'src\renderer\offers\index.html',
    'src\renderer\vouchers\index.html',
    'src\renderer\drivers\index.html',
    'src\renderer\payments\index.html',
    'src\renderer\operations\index.html',
    'src\renderer\whatsapp\index.html',
    'src\renderer\purchase_invoices\index.html',
    'src\renderer\kitchen\index.html',
    'src\renderer\credit_notes\index.html',
    'src\renderer\customer_pricing\index.html',
    'src\renderer\types\index.html',
    'src\renderer\permissions\index.html',
    'src\renderer\zatca\index.html',
    'src\renderer\activation\index.html',
    'src\renderer\login\index.html'
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    if ($content -notmatch 'appointment-notifications\.js') {
        $content = $content -replace '(\s*<script src="\.\/renderer\.js"><\/script>)', "`r`n    <script src=`"../appointment-notifications.js`"></script>`$1"
        Set-Content $file -Value $content -NoNewline
        Write-Host "Updated: $file"
    } else {
        Write-Host "Skipped (already has script): $file"
    }
}

Write-Host "Done!"
