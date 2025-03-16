FROM node:14
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]


# webpage:
#     build: ./webpage
#     ports:
#       - "3000:3000"
#     depends_on:
#       - backend
