# Stage 1: Build
FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Set BASE path for production build to /pos/
RUN npm run build -- --base=/pos/

# Stage 2: Serve
FROM nginx:stable-alpine
# Copy the actual build artifacts to /usr/share/nginx/html/pos for subpath serving
COPY --from=build-stage /app/dist /usr/share/nginx/html/pos
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
