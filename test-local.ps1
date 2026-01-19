$response = Invoke-WebRequest -Uri "http://localhost:7000/stream/movie/tt0111161.json" -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"
Write-Host "Content: $($response.Content)"
