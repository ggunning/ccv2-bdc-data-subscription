# Build the image
try {
    podman build -t ccv2-bdc-data-subscription .
} catch {
    Write-Host "Error: Failed to build the image."
    exit
}

# Push the image
try {
    podman push localhost/ccv2-bdc-data-subscription:latest docker.io/ggunning/ccv2-bdc-data-subscription:latest
    Write-Host "Success: All operations completed successfully."
} catch {
    Write-Host "Error: Failed to push the image."
    exit
}

#podman images -q | ForEach-Object { podman rmi --force $_ }
#podman exec -it rating-app bash
#podman run -d --name rating-app -p 8080:80 rating