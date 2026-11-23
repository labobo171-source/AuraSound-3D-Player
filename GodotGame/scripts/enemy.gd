extends Node2D

var hp := 60
var attack_wait := 1.2

func _ready() -> void:
	add_to_group("enemies")

func _process(delta: float) -> void:
	attack_wait -= delta
	var p = get_tree().get_first_node_in_group("player")
	if is_instance_valid(p):
		var d = p.position - position
		if d.length() > 55:
			position += d.normalized() * 95 * delta
		elif attack_wait <= 0:
			p.hp = max(0, p.hp - 4)
			attack_wait = 1.2
	queue_redraw()

func take_hit(damage: int) -> void:
	hp -= damage

func _draw() -> void:
	draw_circle(Vector2(0, -43), 18, Color("c98d6d"))
	draw_rect(Rect2(-18, -25, 36, 53), Color("b94d4d"))
	draw_rect(Rect2(-24, 26, 16, 32), Color("30303a"))
	draw_rect(Rect2(8, 26, 16, 32), Color("30303a"))
