const leftpad = require('left-pad')

var v = 18432456468
if (v < 0) throw "Cannot write negative variable-length integer"

if (v <= 0x7F) {
  console.log(leftpad(v.toString(2),8,'0'))
} else {
  var i = v
  var bytes = []
  bytes.push(i & 0x7F)
  i >>= 7
  while (i) {
    var b = i & 0x7F | 0x80
    bytes.push(b)
    i >>= 7
  }
  bytes.reverse().forEach((e,i)=>{
    console.log(leftpad(e.toString(2),8,'0'))
  })
}