# lippkg-api

The Minecraft Bedrock mod index API

## Install

Before you start, you need to install [Docker](https://docs.docker.com/install/) and [Docker Compose](https://docs.docker.com/compose/install/).

Clone this repository.

```
git clone https://github.com/futrime/lippkg-api.git
```

Create a `.env` file in the repository directory as the `compose.yaml` file.

```
GITHUB_TOKEN=YOUR_GITHUB_TOKEN
```

You can configure the expiration time and the fetch interval.

```
EXPIRATION=3600
FETCH_INTERVAL=1800
```

Then, run the following command to start the server.

```bash
docker compose up -d
```

Then you can access the server at port `44388` on your host machine. You are likely to need to configure a reverse proxy to access the server from the Internet.

## Usage

## Contributing

Open an issue to ask a question, report a bug, or request a feature.

PRs accepted.

## License

AGPL-3.0-only © futrime
