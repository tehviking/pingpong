# Place all the behaviors and hooks related to the matching controller here.
# All this logic will automatically be available in application.js.
# You can use CoffeeScript in this file: http://jashkenas.github.com/coffee-script/

jQuery ->
  $('#statuses').sortable
    axis: 'y'
    handle: '.handle'
    update: ->
      $.post($(this).data('update-url'), $(this).sortable('serialize'))


incrementers = (() ->
  privateVar = 0

  singleIncrementer = () ->
    privateVar += 1

  doubleIncrementer = () ->
    privateVar += 2
  
  commands = 
    single: singleIncrementer
    double: doubleIncrementer
    value: -> privateVar
)()

class RunsAll
  constructor: (@commands...) ->
  run: -> command() for command in @commands

runner = new RunsAll(incrementers.single, incrementers.double, incrementers.single, incrementers.double)
runner.run()
incrementers.value()

class Rand
  # if created without a seed, uses current time as seed
  constructor: (@seed) ->
    # Knuth and Lewis' improvements to Park and Miller's LCPRNG
    @multiplier = 1664525
    @modulo = 4294967296 # 2**32-1;
    @offset = 1013904223
    unless @seed? && 0 <= seed < @modulo
      @seed = (new Date().valueOf() * new Date().getMilliseconds()) % @modulo

  # sets new seed value
  seed: (seed) ->
    @seed = seed

  # return a random integer 0 <= n < @modulo
  randn: ->
    # new_seed = (a * seed + c) % m
    @seed = (@multiplier*@seed + @offset) % @modulo

 # return a random float 0 <= f < 1.0
  randf: ->
    this.randn() / @modulo

  # return a random int 0 <= f < n
  rand: (n) ->
    Math.floor(this.randf() * n)

  # return a random int min <= f < max
  rand2: (min, max) ->
    min + this.rand(max-min)