"""A plugin written the way an outside author would write it: a file with a factory, nothing else."""


class Exclamation:
    name = "exclamation"
    attributes = ("Tone",)

    def __init__(self, loud="excited"):
        self.loud = loud

    def extract(self, text):
        return {"Tone": [self.loud if "!" in text else "calm"]}


def make(**options):
    return Exclamation(**options)


def not_an_extractor(**options):
    return object()


class Overreaching:
    name = "overreaching"
    attributes = ("Tone",)

    def extract(self, text):
        return {"Tone": ["calm"], "Secret": ["x"]}


def overreaching(**options):
    return Overreaching()
