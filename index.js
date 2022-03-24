const RAS = require('random-access-storage')
const b4a = require('b4a')

const DEFAULT_PAGE_SIZE = 1024 * 1024

module.exports = class MemoryOverlayStorage extends RAS {
  constructor (a, opts = {}) {
    super()

    this._original = a
    this._changes = []
    this._originalSize = 0
    this._size = 0

    this.pageSize = opts.pageSize || DEFAULT_PAGE_SIZE
  }

  _open (req) {
    this._original.open((err) => {
      if (err) return req.callback(err)
      this._original.stat((_, st) => {
        this._size = st && st.size
        this._originalSize = this._size
        req.callback(null)
      })
    })
  }

  _copyInChanges (req, data) {
    let i = Math.floor(req.offset / this.pageSize)
    let rel = req.offset - i * this.pageSize
    let start = 0

    while (start < req.size) {
      const p = i++
      const page = p < this._changes.length ? this._changes[p] : null
      const avail = this.pageSize - rel
      const wanted = req.size - start
      const len = avail < wanted ? avail : wanted

      if (page) b4a.copy(page, data, start, rel, rel + len)
      start += len
      rel = 0
    }

    req.callback(null, data)
  }

  _read (req) {
    const end = req.offset + req.size
    if (end > this._size) return req.callback(new Error('Could not satisfy length'))

    const buf = b4a.alloc(req.size)

    if (req.offset >= this._originalSize) {
      this._copyInChanges(req, buf)
      return
    }

    const oSize = end > this._originalSize ? req.size - (end - this._originalSize) : req.size

    this._original.read(req.offset, oSize, (err, oBuf) => {
      if (err) return req.callback(err, null)

      buf.set(oBuf)

      this._copyInChanges(req, buf)
    })
  }

  async _loadPage (p) {
    if (p < this._changes.length && this._changes[p] !== null) {
      return this._changes[p]
    }

    const offset = p * this.pageSize
    const buf = b4a.alloc(this.pageSize)

    if (offset < this._originalSize) {
      const end = offset + this.pageSize
      const oSize = end > this._originalSize ? this.pageSize - (end - this._originalSize) : this.pageSize

      const oBuf = await new Promise((resolve, reject) => {
        this._original.read(offset, oSize, (err, oBuf) => {
          if (err) return reject(err)
          resolve(oBuf)
        })
      })

      buf.set(oBuf)
    }

    while (this._changes.length <= p) this._changes.push(null)
    if (this._changes[p] === null) this._changes[p] = buf
    return this._changes[p]
  }

  async _write (req) {
    let i = Math.floor(req.offset / this.pageSize)
    let rel = req.offset - i * this.pageSize
    let start = 0

    const len = req.offset + req.size
    if (len > this._size) this._size = len

    while (start < req.size) {
      const p = i++
      let page = null

      try {
        page = await this._loadPage(p)
      } catch (err) {
        return req.callback(err, null)
      }

      const free = this.pageSize - rel
      const end = free < (req.size - start)
        ? start + free
        : req.size

      b4a.copy(req.data, page, rel, start, end)
      start = end
      rel = 0
    }

    req.callback(null, null)
  }

  async _del (req) {
    let i = Math.floor(req.offset / this.pageSize)
    let rel = req.offset - i * this.pageSize
    let start = 0

    if (rel && req.offset + req.size >= this._size) {
      try {
        const buf = await this._loadPage(i)
        if (buf) buf.fill(0, rel)
      } catch (err) {
        return req.callback(err, null)
      }
    }

    if (req.offset + req.size > this._size) {
      req.size = Math.max(0, this._size - req.offset)
    }

    while (start < req.size) {
      if (rel === 0 && req.size - start >= this.pageSize) {
        try {
          const buf = await this._loadPage(i++)
          buf.fill(0)
        } catch (err) {
          return req.callback(err, null)
        }
      }

      rel = 0
      start += this.pageSize - rel
    }

    if (req.offset + req.size >= this._size) {
      this._size = req.offset
    }

    req.callback(null, null)
  }

  _stat (req) {
    this.open((err) => {
      if (err) return req.callback(err, null)
      req.callback(null, { size: this._size })
    })
  }
}
