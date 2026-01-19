FROM node:20-bookworm

# Install system dependencies
# python3-launchpadlib is sometimes needed for ppa support, but full and pip should be enough
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment for python tools to avoid PEP 668 issues
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install scraping tools
RUN pip install --no-cache-dir gallery-dl yt-dlp

# Set working directory
WORKDIR /app

# We don't COPY source here because we will bind mount it in docker-compose for development
# verify tools
RUN gallery-dl --version && yt-dlp --version && ffmpeg -version

# Expose Next.js port
EXPOSE 3000

# Default command for development
CMD ["npm", "run", "dev"]
