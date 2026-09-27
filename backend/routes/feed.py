
@feed_bp.get(" /lives\)
def get_active_lives():
 from backend.sockets import active_lives
 return ok({\lives\: list(active_lives.values())})
