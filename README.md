# LipIndex

API server for querying published Lip teeth.

## Usage

We support various deployment methods.

### Docker Compose

Before you start, you need to install [Docker](https://docs.docker.com/install/) and [Docker Compose](https://docs.docker.com/compose/install/).

Download the `docker-compose.yml` file from this repository.

```bash
curl -LO https://raw.githubusercontent.com/LipPkg/LipIndex/HEAD/docker-compose.yml
```

Create a `.env` file in the same directory as the `docker-compose.yml` file. The `.env` file should contain the following content.

```bash
GITHUB_BOT_TOKEN=<Your GitHub PAT>
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

### Docker

Before you start, you need to install [Docker](https://docs.docker.com/install/).

Install PostgreSQL.

```bash
docker run -d -e POSTGRES_PASSWORD=postgres --name lipindex-postgres --restart=always postgres
```

Install LipIndex.

```bash
docker run -d -e GITHUB_BOT_TOKEN=<Your GitHub PAT> -e NODE_ENV=production --link lipindex-postgres:postgres -p <API port>:11400 futrime/lipindex
```
