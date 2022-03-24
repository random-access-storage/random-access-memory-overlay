const test = require('brittle')
const RAO = require('./')
const RAM = require('random-access-memory')

test('write and read', function (t) {
  t.plan(3)

  const file = new RAO(new RAM())

  file.write(0, Buffer.from('hello'), function (err) {
    t.not(err, 'no error')
    file.read(0, 5, function (err, buf) {
      t.not(err, 'no error')
      t.alike(buf, Buffer.from('hello'))
    })
  })
})

test('read empty', function (t) {
  t.plan(2)

  const file = new RAO(new RAM())

  file.read(0, 0, function (err, buf) {
    t.not(err, 'no error')
    t.alike(buf, Buffer.alloc(0), 'empty buffer')
  })
})

test('read range > file', function (t) {
  t.plan(1)

  const file = new RAO(new RAM())

  file.read(0, 5, function (err, buf) {
    t.ok(err, 'not satisfiable')
  })
})

test('random access write and read', function (t) {
  t.plan(8)

  const file = new RAO(new RAM())

  file.write(10, Buffer.from('hi'), function (err) {
    t.not(err, 'no error')
    file.write(0, Buffer.from('hello'), function (err) {
      t.not(err, 'no error')
      file.read(10, 2, function (err, buf) {
        t.not(err, 'no error')
        t.alike(buf, Buffer.from('hi'))
        file.read(0, 5, function (err, buf) {
          t.not(err, 'no error')
          t.alike(buf, Buffer.from('hello'))
          file.read(5, 5, function (err, buf) {
            t.not(err, 'no error')
            t.alike(buf, Buffer.from([0, 0, 0, 0, 0]))
          })
        })
      })
    })
  })
})

test('buffer constructor', function (t) {
  t.plan(2)

  const file = new RAO(new RAM(Buffer.from('contents')))

  file.read(0, 7, function (err, buf) {
    t.not(err)
    t.alike(buf, Buffer.from('content'))
  })
})

test('not sync', function (t) {
  t.plan(3)

  const file = new RAO(new RAM())
  let sync = true
  file.write(10, Buffer.from('hi'), function () {
    t.not(sync)
    sync = true
    file.write(0, Buffer.from('hello'), function () {
      t.not(sync)
      sync = true
      file.read(10, 2, function () {
        t.not(sync)
      })
      sync = false
    })
    sync = false
  })
  sync = false
})

test('dels and stuff', function (t) {
  t.plan(5)

  const file = new RAO(new RAM(Buffer.from('contents')), { pageSize: 2 })

  file.write(0, Buffer.from('d'), function (err) {
    t.not(err)
    file.read(0, 3, function (_, buf) {
      t.alike(buf, Buffer.from('don'))
      file.write(7, Buffer.from('zzz'), function () {
        file.read(0, 10, function (_, buf) {
          t.alike(buf, Buffer.from('dontentzzz'))
          file.read(0, 11, function (err) {
            t.ok(err)
            file.del(9, Infinity, function () {
              file.stat(function (_, st) {
                t.is(st.size, 9)
              })
            })
          })
        })
      })
    })
  })
})
