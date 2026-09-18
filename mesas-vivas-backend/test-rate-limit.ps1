for ($i = 1; $i -le 12; $i++) {
    Write-Host "Intento $i ->" -NoNewline
    curl.exe -s -o NUL -w " status %{http_code}`n" -X POST http://localhost:3000/auth/login `
        -H "Content-Type: application/json" `
        -d '{\"email\":\"noexiste@test.com\",\"password\":\"cualquiera\"}'
}