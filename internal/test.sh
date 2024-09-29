#!/bin/bash
set -e

bash internal/build.sh
jest
