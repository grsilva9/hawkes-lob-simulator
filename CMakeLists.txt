cmake_minimum_required(VERSION 3.16)
project(lob_simulation LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)  # Required for shared libraries

# Compiler warnings
if (MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# =========================
# Core LOB Library (static)
# =========================
add_library(lob_core STATIC
    cpp/src/order_book.cpp
    cpp/src/hawkes_multivariate_process.cpp
    cpp/src/hawkes_univariate_process.cpp
    cpp/src/poisson_process.cpp
    cpp/src/csv_logger.cpp
)

target_include_directories(lob_core PUBLIC cpp/include)

# =========================
# Standalone executable
# =========================
add_executable(simulate_hawkes_multivariate
    cpp/apps/simulate_hawkes_multivariate.cpp
)

target_link_libraries(simulate_hawkes_multivariate PRIVATE lob_core)

# =========================
# Python bindings with Pybind11
# =========================
find_package(pybind11 CONFIG)

if(pybind11_FOUND)
    message(STATUS "Found pybind11: Building Python module")
    
    pybind11_add_module(lob_core_py 
        python/bindings/lob_bindings.cpp
    )
    
    # Link against our C++ library
    target_link_libraries(lob_core_py PRIVATE lob_core)
    
    # Set output name to just "lob_core" (without the _py suffix)
    set_target_properties(lob_core_py PROPERTIES OUTPUT_NAME "lob_core")
    
else()
    message(WARNING "pybind11 not found - Python bindings will not be built")
endif()


# Install Python module into python/lob_simulator
install(TARGETS lob_core_py
        LIBRARY DESTINATION python/lob_simulator)
