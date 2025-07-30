# NGINX REPAIR COMMANDS

## Repair 1 - Fix gateway status endpoint (line 103)
```bash
sudo sed -i '103s/.*/        return 200 '"'"'{"gateway":"nginx","upstreams":["user_service:3001","customer_service:3002","order_service:3003"],"status":"healthy"}'"'"';/' /etc/nginx/sites-available/firemni-asistent-gateway
```

## Repair 2 - Fix gateway health endpoint (line 108) 
```bash
sudo sed -i '108s/.*/        return 200 '"'"'{"user_service":"http:\/\/localhost:3001\/health","customer_service":"http:\/\/localhost:3002\/health","order_service":"http:\/\/localhost:3003\/health"}'"'"';/' /etc/nginx/sites-available/firemni-asistent-gateway
```

## Repair 3 - Fix landing page endpoint (line 114)
```bash
sudo sed -i '114s/.*/        return 200 '"'"'{"message":"Firemni Asistent API Gateway","endpoints":{"/api/users/":"User management","/api/customers/":"Customer management","/api/orders/":"Order management"}}'"'"';/' /etc/nginx/sites-available/firemni-asistent-gateway
```

## Repair 4 - Test nginx configuration
```bash
sudo nginx -t
```

## Repair 5 - Reload nginx if test passes
```bash
sudo systemctl reload nginx
```