# NGINX SUDO COMMANDS FOR RELACE 12B

## Command 5 - Add order service to health check
```bash
sudo sed -i 's/:3002\/health"/:3002\/health","order_service":"http:\/\/localhost:3003\/health"/' /etc/nginx/sites-available/firemni-asistent-gateway
```

## Command 6 - Update gateway status to include order service
```bash
sudo sed -i 's/"upstreams":\["user_service:3001","customer_service:3002"\]/"upstreams":["user_service:3001","customer_service:3002","order_service:3003"]/' /etc/nginx/sites-available/firemni-asistent-gateway
```

## Command 7 - Update gateway landing page to include order service
```bash
sudo sed -i 's/"\/api\/customers\/":"Customer management"/"\/api\/customers\/":"Customer management","\/api\/orders\/":"Order management"/' /etc/nginx/sites-available/firemni-asistent-gateway
```

## Command 8 - Test nginx configuration
```bash
sudo nginx -t
```

## Command 9 - Reload nginx to apply changes
```bash
sudo systemctl reload nginx
```