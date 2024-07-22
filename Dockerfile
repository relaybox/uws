FROM node:20-alpine

COPY /build /src
COPY /package.json /src/package.json

ENV NODE_ENV=production

WORKDIR /src

RUN apk add --no-cache gcompat
RUN apk add --no-cache make g++ cmake python3 git
RUN npm i --verbose
# RUN npm install --verbose github:livecloud-labs/uWebSockets.js#v20.44.0

EXPOSE 4004

CMD ["node", "server.js"]