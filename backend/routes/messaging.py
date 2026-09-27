from flask import Blueprint, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Conversation, ConversationParticipant, Message, User, new_id
from ..utils import err, ok, notify

messaging_bp = Blueprint("messaging", __name__, url_prefix="/api")


def _get_conversation_or_403(conv_id):
    conv = Conversation.query.get(conv_id)
    if not conv:
        return None, err("Conversation not found.", 404)
    participant_ids = [p.user_id for p in conv.participants]
    if current_user.id not in participant_ids:
        return None, err("You are not part of this conversation.", 403)
    return conv, None


@messaging_bp.get("/conversations")
@login_required
def list_conversations():
    my_conv_ids = [cp.conversation_id for cp in
                   ConversationParticipant.query.filter_by(user_id=current_user.id).all()]
    conversations = [Conversation.query.get(cid).to_dict() for cid in my_conv_ids]
    return ok({"conversations": conversations})


@messaging_bp.post("/conversations")
@login_required
def get_or_create_conversation():
    data = request.get_json(silent=True) or {}
    other_id = data.get("otherUserId")
    if not other_id:
        return err("otherUserId is required.")
    if not User.query.get(other_id):
        return err("User not found.", 404)

    my_conv_ids = {cp.conversation_id for cp in
                   ConversationParticipant.query.filter_by(user_id=current_user.id).all()}
    other_conv_ids = {cp.conversation_id for cp in
                       ConversationParticipant.query.filter_by(user_id=other_id).all()}
    shared = my_conv_ids & other_conv_ids

    conv = None
    for cid in shared:
        c = Conversation.query.get(cid)
        if c and len(c.participants) == 2:
            conv = c
            break

    if not conv:
        conv = Conversation(id=data.get("id") or new_id("conv"))
        if Conversation.query.get(conv.id):
            conv.id = new_id("conv")
        db.session.add(conv)
        db.session.flush()
        db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=current_user.id))
        db.session.add(ConversationParticipant(conversation_id=conv.id, user_id=other_id))
        db.session.commit()

    return ok({"conversation": conv.to_dict()}, 201)


@messaging_bp.get("/conversations/<conv_id>/messages")
@login_required
def get_messages(conv_id):
    conv, error = _get_conversation_or_403(conv_id)
    if error:
        return error
    return ok({"conversation": conv.to_dict()})


@messaging_bp.post("/conversations/<conv_id>/messages")
@login_required
def send_message(conv_id):
    conv, error = _get_conversation_or_403(conv_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    text = data.get("text")
    msg_type = data.get("type") or "text"
    reply_to = data.get("replyTo")

    if text is None or (msg_type == "text" and not str(text).strip()):
        return err("Message text is required.")

    message = Message(
        id=data.get("id") or new_id("m"),
        conversation_id=conv_id,
        sender_id=current_user.id,
        text=text,
        type=msg_type,
        reply_to=reply_to,
    )
    if Message.query.get(message.id):
        message.id = new_id("m")

    db.session.add(message)

    other_ids = [p.user_id for p in conv.participants if p.user_id != current_user.id]
    for oid in other_ids:
        notify(oid, current_user.id, "message", f"{current_user.name} sent you a message.", conv_id)

    db.session.commit()
    return ok({"message": message.to_dict()}, 201)


@messaging_bp.put("/messages/<msg_id>")
@login_required
def edit_message(msg_id):
    message = Message.query.get(msg_id)
    if not message:
        return err("Message not found.", 404)
    if message.sender_id != current_user.id:
        return err("You can only edit your own messages.", 403)
    if message.type != "text":
        return err("Only text messages can be edited.")

    data = request.get_json(silent=True) or {}
    new_text = (data.get("text") or "").strip()
    if not new_text:
        return err("Message text is required.")

    message.text = new_text
    message.is_edited = True
    db.session.commit()
    return ok({"message": message.to_dict()})


@messaging_bp.delete("/messages/<msg_id>")
@login_required
def delete_message(msg_id):
    message = Message.query.get(msg_id)
    if not message:
        return err("Message not found.", 404)
    if message.sender_id != current_user.id:
        return err("You can only unsend your own messages.", 403)

    db.session.delete(message)
    db.session.commit()
    return ok()


@messaging_bp.post("/messages/<msg_id>/react")
@login_required
def react_to_message(msg_id):
    message = Message.query.get(msg_id)
    if not message:
        return err("Message not found.", 404)

    data = request.get_json(silent=True) or {}
    reaction = data.get("reaction", "\u2764\ufe0f")
    message.reaction = None if message.reaction else reaction
    db.session.commit()
    return ok({"message": message.to_dict()})
