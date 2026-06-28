FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

FROM nginx:alpine

RUN addgroup -S notica && adduser -S notica -G notica

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R notica:notica /usr/share/nginx/html \
 && chown -R notica:notica /var/cache/nginx \
 && touch /var/run/nginx.pid \
 && chown notica:notica /var/run/nginx.pid

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
