kill -9 $(lsof -t -i :8080)
kubectl port-forward svc/fos-metadata-catalog-svc 8081:8080 -n fos &

