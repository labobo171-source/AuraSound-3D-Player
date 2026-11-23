extends Node2D

func _ready() -> void:
	add_to_group("player")

var hp := 100
var special_meter := 0
var speed := 290.0
var attack_timer := 0.0
var combo_step := 0
var combo_timer := 0.0
var facing := 1

func _process(delta: float) -> void:
	var input_dir := Vector2.ZERO
	input_dir.x = Input.get_axis("ui_left", "ui_right")
	input_dir.y = Input.get_axis("ui_up", "ui_down")
	if input_dir.length() > 1.0:
		input_dir = input_dir.normalized()
	position += input_dir * speed * delta
	position.x = clamp(position.x, 40, 1240)
	position.y = clamp(position.y, 370, 620)
	if input_dir.x != 0:
		facing = sign(input_dir.x)
	attack_timer = max(0.0, attack_timer - delta)
	combo_timer = max(0.0, combo_timer - delta)
	if combo_timer == 0:
		combo_step = 0
	if Input.is_action_just_pressed("ui_accept") or Input.is_action_just_pressed("attack"):
		attack()
	if Input.is_action_just_pressed("special") and special_meter >= 100:
		special_meter = 0
		get_tree().call_group("enemies", "take_hit", 45)
	queue_redraw()

func attack() -> void:
	if attack_timer > 0:
		return
	combo_step = (combo_step % 3) + 1
	combo_timer = 0.8
	attack_timer = 0.25
	special_meter = min(100, special_meter + 12)
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if is_instance_valid(enemy) and abs(enemy.position.x - position.x) < 100 and abs(enemy.position.y - position.y) < 75:
			enemy.take_hit(18 + combo_step * 4)
			enemy.position.x += 45 * facing

func _draw() -> void:
	var body_color = Color("45a9d7")
	draw_circle(Vector2(0, -48), 19, Color("e4b38d"))
	draw_rect(Rect2(-18, -30, 36, 55), body_color)
	draw_rect(Rect2(-26, 20, 18, 38), Color("202431"))
	draw_rect(Rect2(8, 20, 18, 38), Color("202431"))
	if attack_timer > 0:
		var fist_x = 50 * facing
		draw_rect(Rect2(fist_x - 14, -22, 28, 18), Color("f1c09a"))
