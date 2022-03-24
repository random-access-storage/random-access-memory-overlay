# random-access-memory-overlay

Random Access Storage instance that stores mutations in a memory overlay instead of writing them to the underlying storage.

```
npm install random-access-memory-overlay
```

Useful for fixtures etc.

## Usage

``` js
const RAO = require('random-access-memory-overlay')

// make some storage instance
const file = new RandomAccessFile('./my-file')

// make an overlay
const overlay = new RAO(file)

// any mutations done to overlay (ie write, del) are just tracked in memory
// any reads go through the overlay and then the underlying storage
```

## License

MIT
