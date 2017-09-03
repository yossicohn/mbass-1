var fs = require('fs')

module.exports = function math( options ) { 


  function make_log( fd ) {
    return function( entry ) {
      fs.write( fd, new Date().toISOString()+' '+entry, null, 'utf8', function(err) {
        if( err ) return console.log( err )

        // ensure log entry is flushed
        fs.fsync( fd, function(err) {
          if( err ) return console.log( err )
        })
      }) 
    }
  }
  

  function init( msg, respond ) {
    // log to a custom file
    fs.open( options.logfile, 'a', function( err, fd ) {

      // cannot open for writing, so fail
      // this error is fatal to Seneca
      if( err ) return respond( err )

      log = make_log(fd)
      respond()
    })
  }

  this.add( 'role:math,cmd:sum', function sum( msg, respond ) {
    respond( null, { answer: msg.left + msg.right } )
  })

  this.add( 'role:math,cmd:product', function product( msg, respond ) {
    respond( null, { answer: msg.left * msg.right } )
  })

  this.wrap( 'role:math', function( msg, respond ) {
    msg.left  = Number(msg.left).valueOf()
    msg.right = Number(msg.right).valueOf()
    this.prior( msg, respond )
  })



}
