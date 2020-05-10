# Delete old GitHub package versions

Delete GitHub package versions older than a specified age.

## Example workflow

```
name: test
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: ./
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          packageName: main
          minAge: 0.5d
```

## Documentation

See `action.yml`

## Author

Andreas Brekken <andreas@brekken.com>
