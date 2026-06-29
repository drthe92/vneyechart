# Optotype Generator for Clinical Visual Acuity Testing

This Python script generates standardized SVG optotypes for vision testing charts with strict adherence to clinical optical principles.

## Features

- **Equal Legibility**: All optotypes in a set maintain equal recognition difficulty
- **Contour Interaction Control**: Proper spacing prevents edge interference
- **Crowding Effect Mitigation**: Correct inter-optotype spacing
- **Ink Area Equilibrium**: ±5% area consistency across optotypes
- **Stroke Standardization**: Uniform stroke width throughout each optotype

## Supported Optotype Types

1. **Sloan Letters** (C, D, H, K, N, O, R, S, V, Z)
2. **LEA Symbols** (Circle, Square, House, Heart/Appletree)
3. **Landolt C**
4. **Tumbling E**

## Installation

This script uses only Python standard library, no external dependencies required.

```bash
# Clone or download the script
python optotype_generator.py --help
```

## Usage Examples

```bash
# Generate a Sloan C letter
python optotype_generator.py --type sloan --optotype C --output sloan_C.svg

# Generate a LEA House symbol
python optotype_generator.py --type lea --optotype house --output lea_house.svg

# Generate a Landolt C
python optotype_generator.py --type landolt --output landolt_c.svg

# Generate a Tumbling E
python optotype_generator.py --type tumbling --output tumbling_e.svg

# Generate with custom grid size and stroke ratio
python optotype_generator.py --type sloan --optotype D --grid-size 200 --stroke-ratio 0.15 --output large_sloan_D.svg
```

## Clinical Optical Principles

### Grid Size and Stroke Ratio
- Default grid size: 100x100 units
- Default stroke ratio: 1/5 (20 units for 100x100 grid)
- All measurements are mathematically derived from these parameters

### Internal Spacing
- Minimum internal spacing: Exactly 1 stroke width
- Ensures contour interaction doesn't affect recognition thresholds

### Ink Area Equilibrium
- All optotypes in a set maintain ±5% area consistency
- Critical for valid psychophysical testing

### Stroke Standardization
- Consistent stroke width throughout each optotype
- Rounded line caps and joins to minimize optical artifacts

## Integration with Vision Therapy WebApp

The generated SVGs can be directly integrated into the existing web application:

1. Replace paths in `modules/etdrs_chart.js` with generated Sloan letters
2. Replace paths in `modules/lea_symbols.js` with generated LEA symbols
3. Use generated optotypes to create new vision testing charts

## Technical Implementation

The script uses mathematical calculations for all path coordinates:
- No hardcoded values
- All points derived from grid_size and stroke_width parameters
- Consistent with clinical standards for optotype design