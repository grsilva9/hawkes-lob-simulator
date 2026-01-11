#pragma once

#include "event.h"

class EventProcess {
public:
    virtual ~ EventProcess() = default;

    //Generates the next event, given current time t.
    virtual Event next(double t) = 0;
};

