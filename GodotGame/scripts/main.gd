extends Node2D

const Fighter = preload("res://scripts/player.gd")
const Enemy = preload("res://scripts/enemy.gd")
var player
var enemies: Array = []
var score := 0
var spawn_clock := 0.0
var hud: Label

func _ready() -> void:
	player = Fighter.new()
	player.position = Vector2(260, 440)
	add_child(player)
	for i in range(3):
		spawn_enemy(Vector2(750 + i * 100, 420 + i * 25))
	hud = Label.new()
	hud.position = Vector2(22, 18)
	hud.add_theme_font_size_override("font_size", 26)
	add_child(hud)
	update_hud()

func _process(delta: float) -> void:
	spawn_clock += delta
	if spawn_clock > 7.0 and enemies.size() < 5:
		spawn_clock = 0.0
		spawn_enemy(Vector2(1050, randf_range(380, 500)))
	for e in enemies.duplicate():
		if not is_instance_valid(e):
			enemies.erase(e)
		elif e.hp <= 0:
			enemies.erase(e)
			e.queue_free()
			score += 100
	update_hud()
	queue_redraw()

func update_hud() -> void:
	if is_instance_valid(hud) and is_instance_valid(player):
		hud.text = "STREET BRAWLER   HP: %d   SPECIAL: %d%%   SCORE: %d" % [player.hp, player.special_meter, score]

func spawn_enemy(pos: Vector2) -> void:
	var e = Enemy.new()
	e.position = pos
	add_child(e)
	enemies.append(e)

func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color("20212b"))
	draw_rect(Rect2(0, 120, 1280, 230), Color("343644"))
	for x in range(0, 1280, 220):
		draw_rect(Rect2(x + 18, 150, 115, 95), Color("4d5263"))
		draw_rect(Rect2(x + 30, 164, 28, 30), Color("f3b65c"))
		draw_rect(Rect2(x + 78, 164, 28, 30), Color("f3b65c"))
		draw_rect(Rect2(x + 30, 205, 28, 30), Color("f3b65c"))
		draw_rect(Rect2(x + 78, 205, 28, 30), Color("f3b65c"))
	draw_rect(Rect2(0, 350, 1280, 370), Color("44434a"))
	draw_rect(Rect2(0, 530, 1280, 5), Color("b9b4a8"))
	for x in range(20, 1280, 150):
		draw_rect(Rect2(x, 610, 70, 5), Color("d2bd76"))
