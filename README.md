# lip-index

An API backend for indexing lip packages

## Install

Before you start, you need to install [Docker](https://docs.docker.com/install/) and [Docker Compose](https://docs.docker.com/compose/install/).

Download the `docker-compose.yml` file from this repository.

```bash
curl -LO https://raw.githubusercontent.com/lippkg/lip-index/HEAD/docker-compose.yml
```

Edit the `docker-compose.yml` file to set the `GITHUB_BOT_TOKEN` environment variable. You can also set the `GITHUB_BOT_EXPIRE` and `GITHUB_BOT_INTERVAL` environment variables if you want. The default values are `600` and `60` respectively.

```yaml
    environment:
      GITHUB_BOT_EXPIRE: 600
      GITHUB_BOT_INTERVAL: 60
      GITHUB_BOT_TOKEN: YOUR_GITHUB_TOKEN
```

Then, run the following command to start the server.

```bash
docker-compose up -d
```

If you are not root, you may need to run the following command instead.

```bash
sudo docker-compose up -d
```

To stop the server, run the following command.

```bash
docker-compose down
```

Then you can access the server at port `44388` on your host machine. You are likely to need to configure a reverse proxy to access the server from the Internet.

## Usage

## Contributing

Open an issue to ask a question, report a bug, or request a feature.

PRs accepted.

## License

AGPL-3.0-only © lippkg
