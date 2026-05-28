#!/bin/bash
# CRAGS backend test runner

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
if [ ! -x "$PYTHON_BIN" ]; then
    PYTHON_BIN="${PYTHON_BIN_FALLBACK:-python}"
fi

export PYTHONPATH="${PYTHONPATH:-src}"
export CRAGS_TEST_DATABASE_URL="${CRAGS_TEST_DATABASE_URL:-${DATABASE_URL:-postgresql+psycopg://crags:crags@127.0.0.1:5433/crags}}"

VERBOSE=""
COVERAGE=""
MARKERS=""
SPECIFIC_TEST=""
FAILED_ONLY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="-vv"
            shift
            ;;
        -c|--coverage)
            COVERAGE="--cov=crags --cov-report=html --cov-report=term-missing"
            shift
            ;;
        -u|--unit)
            MARKERS="-m unit"
            shift
            ;;
        -i|--integration)
            MARKERS="-m integration"
            shift
            ;;
        -s|--specific)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        -f|--failed)
            FAILED_ONLY="--lf"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "  -v, --verbose        Verbose output"
            echo "  -c, --coverage       Generate coverage report"
            echo "  -u, --unit           Run only unit tests"
            echo "  -i, --integration    Run only integration tests"
            echo "  -s, --specific TEST  Run a specific file, node id, or -k pattern target"
            echo "  -f, --failed         Run only previously failed tests"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}CRAGS Backend Test Suite${NC}"
echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}PYTHONPATH=${PYTHONPATH}${NC}"
echo -e "${YELLOW}CRAGS_TEST_DATABASE_URL=${CRAGS_TEST_DATABASE_URL}${NC}"
echo ""

if [ -n "$SPECIFIC_TEST" ]; then
    echo -e "${YELLOW}Running specific target: $SPECIFIC_TEST${NC}"
    "$PYTHON_BIN" -m pytest "$SPECIFIC_TEST" $VERBOSE $COVERAGE $MARKERS $FAILED_ONLY
elif [ -n "$MARKERS" ]; then
    echo -e "${YELLOW}Running marker selection: $MARKERS${NC}"
    "$PYTHON_BIN" -m pytest tests/ $VERBOSE $COVERAGE $MARKERS $FAILED_ONLY
else
    echo -e "${YELLOW}Running all backend tests...${NC}"
    "$PYTHON_BIN" -m pytest tests/ $VERBOSE $COVERAGE $FAILED_ONLY
fi

echo ""
echo -e "${GREEN}Test run completed successfully.${NC}"
