# How to Check Logs

Depending on how you are running the addon, use one of the following methods to view the logs.

## Option 1: Running with Docker (Recommended)
If you deployed using Docker, run this command in your terminal:

```bash
docker logs -f nuvio-addon
```
*(Replace `nuvio-addon` with your actual container name if it's different. You can find it with `docker ps`)*

## Option 2: Running with PM2
If you are using PM2 to keep the addon running:

```bash
pm2 logs
```
Or for a specific process:
```bash
pm2 logs addon
```

## Option 3: Running Manually (Node.js)
If you are running it directly in the terminal:

1. Stop the current process (Ctrl+C).
2. Run it again and redirect output to a file:
```bash
node addon.js > debug_log.txt 2>&1
```
3. Let it run for a minute and try to play a stream.
4. Open `debug_log.txt` to see the logs.

## What to Look For
Search the logs for lines containing:
- `[Vidlink]`
- `[NetMirror]`
- `ECONNRESET`
- `Error`

Please copy and paste the relevant error sections or the whole log file if it's not too large.
