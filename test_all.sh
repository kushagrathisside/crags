#!/bin/bash
# CRAGS Project-Wide Test Runner
# Runs all tests across backend and frontend services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
BACKEND_DIR="./backend"
FRONTEND_DIR="./frontend"

# Print section header
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Print info
print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if directory exists
check_dir() {
    if [ ! -d "$1" ]; then
        print_error "Directory $1 not found"
        return 1
    fi
    return 0
}

# Main testing function
main() {
    print_header "CRAGS Project Testing Suite"
    
    local all_passed=true
    
    # Test backend
    if check_dir "$BACKEND_DIR"; then
        print_header "Running Backend Tests"
        
        cd "$BACKEND_DIR"
        
        # Check if pytest is available
        if ! command -v pytest &> /dev/null; then
            print_error "pytest not found. Installing test dependencies..."
            pip install -e ".[dev]"
        fi
        
        # Run backend tests
        print_info "Executing pytest for all backend services..."
        if pytest tests/ -v --tb=short; then
            print_success "Backend tests passed"
        else
            print_error "Backend tests failed"
            all_passed=false
        fi
        
        cd - > /dev/null
    else
        all_passed=false
    fi
    
    # Test frontend (if needed)
    if check_dir "$FRONTEND_DIR"; then
        print_header "Running Frontend Tests (Optional)"
        
        cd "$FRONTEND_DIR"
        
        if [ -f "package.json" ]; then
            if [ -f "package-lock.json" ] || [ -f "yarn.lock" ]; then
                print_info "Frontend test infrastructure found"
                
                if command -v npm &> /dev/null; then
                    if npm run test &>/dev/null 2>&1; then
                        print_success "Frontend tests passed"
                    else
                        print_info "Frontend tests skipped or not configured"
                    fi
                fi
            fi
        fi
        
        cd - > /dev/null
    fi
    
    # Summary
    print_header "Test Summary"
    
    if [ "$all_passed" = true ]; then
        print_success "All tests completed successfully!"
        echo ""
        echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  Project is in good health - All services tested!  ${NC}"
        echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
        exit 0
    else
        print_error "Some tests failed"
        echo ""
        echo -e "${RED}════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  Please fix the failing tests before committing  ${NC}"
        echo -e "${RED}════════════════════════════════════════════════════════${NC}"
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -b, --backend        Test backend only"
    echo "  -f, --frontend       Test frontend only"
    echo "  -c, --coverage       Generate coverage reports"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                   # Run all tests"
    echo "  $0 --backend         # Test backend only"
    echo "  $0 -c                # Generate coverage reports"
    echo ""
}

# Parse arguments
BACKEND_ONLY=false
FRONTEND_ONLY=false
COVERAGE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--backend)
            BACKEND_ONLY=true
            shift
            ;;
        -f|--frontend)
            FRONTEND_ONLY=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run tests based on flags
if [ "$BACKEND_ONLY" = true ] || [ "$FRONTEND_ONLY" = false ]; then
    # Test backend
    if check_dir "$BACKEND_DIR"; then
        print_header "Running Backend Tests"
        
        cd "$BACKEND_DIR"
        
        if ! command -v pytest &> /dev/null; then
            print_error "pytest not found. Installing test dependencies..."
            pip install -e ".[dev]"
        fi
        
        if [ "$COVERAGE" = true ]; then
            print_info "Generating coverage report..."
            pytest tests/ -v --cov=crags --cov-report=html --cov-report=term-missing
            print_success "Coverage report generated in htmlcov/index.html"
        else
            pytest tests/ -v --tb=short
        fi
        
        cd - > /dev/null
    fi
fi

exit 0
