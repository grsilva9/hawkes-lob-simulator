FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN pip install --upgrade pip && pip install -r requirements.txt

# Make pybind11 discoverable to CMake
RUN rm -rf build \
    && mkdir -p build \
    && cd build \
    && cmake .. -DCMAKE_INSTALL_PREFIX=.. -Dpybind11_DIR=$(python -m pybind11 --cmakedir) \
    && make -j$(nproc) \
    && make install

EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "python.lob_simulator.api:app"]
