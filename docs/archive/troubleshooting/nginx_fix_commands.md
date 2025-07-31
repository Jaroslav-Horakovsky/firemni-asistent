# NGINX FIX COMMANDS FOR RELACE 12B

## Fix 1 - Add order service routes and close server block
```bash
sudo bash -c 'cat >> /etc/nginx/sites-available/firemni-asistent-gateway << "EOF"

    # Order Service Routes - Order management
    location /api/orders/ {
        # Handle preflight requests
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type "text/plain; charset=utf-8";
            add_header Content-Length 0;
            return 204;
        }
        
        proxy_pass http://order_service/orders/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Gateway status and health endpoints
    location /gateway/status {
        return 200 '{"gateway":"nginx","upstreams":["user_service:3001","customer_service:3002","order_service:3003"],"status":"healthy"}';
        add_header Content-Type application/json;
    }

    location /gateway/health {
        return 200 '{"user_service":"http://localhost:3001/health","customer_service":"http://localhost:3002/health","order_service":"http://localhost:3003/health"}';
        add_header Content-Type application/json;
    }

    # Landing page
    location / {
        return 200 '{"message":"Firemní Asistent API Gateway","services":{"user":"http://localhost:8080/api/users/","customer":"http://localhost:8080/api/customers/","order":"http://localhost:8080/api/orders/"},"endpoints":{"/api/users/":"User management","/api/customers/":"Customer management","/api/orders/":"Order management"}}';
        add_header Content-Type application/json;
    }
}
EOF'
```

## Fix 2 - Test nginx configuration
```bash
sudo nginx -t
```

## Fix 3 - Reload nginx
```bash
sudo systemctl reload nginx
```