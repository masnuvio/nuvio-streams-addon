$response = Invoke-WebRequest -Uri "http://localhost:7000/stream/movie/tt0111161.json" -UseBasicParsing
$response.Content | Out-File "c:\Users\Administrator\Desktop\nuvio stream\stream-response.json" -Encoding UTF8
