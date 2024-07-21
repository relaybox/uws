FROM node:20-alpine

COPY /build /src
COPY /package.json /src/package.json

ENV NODE_ENV=production

WORKDIR /src
RUN npm i
# RUN npm install --verbose github:uNetworking/uWebSockets.js#v20.44.0
RUN cp -r /uWebsockets,js /src/node_modules/uWebsockets,js

EXPOSE 4004
CMD ["node", "server.js"]