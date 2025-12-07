# Sử dụng Node LTS để ổn định
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# Cài dependency
RUN npm install

# Copy toàn bộ source code vào container
COPY . .

EXPOSE 3000

# Lệnh start server
CMD ["npm", "start"]
