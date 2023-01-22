import dayjs from 'dayjs'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from "./lib/prisma"

export async function appRoutes(app: FastifyInstance) {
    // salvar nova hábito
    app.post('/habits', async (req) => {
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(
                z.number().min(0).max(6)
            )
        })

        const { title, weekDays } = createHabitBody.parse(req.body);

        //zera as horas, minutos e segundos
        const today = dayjs().startOf('day').toDate()

        await prisma.habit.create({
            data: {
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map(weekDay => {
                        return {
                            week_day: weekDay
                        }
                    })
                }
            }
        })
    })

    // obter hábitos completos e possíveis de um dia.
    app.get('/day', async (req) => {
        const getDayParams = z.object({
            date: z.coerce.date() //corce pq oq vem do front end é uma String, coerce converte para date.
        })

        const { date } = getDayParams.parse(req.query)

        const parsedDate = dayjs(date).startOf('day')
        const weekDay = parsedDate.get('day')

        const possibleHabits = await prisma.habit.findMany({
            where: {
                created_at: {
                    lte: date,
                },
                weekDays: {
                    some: {
                        week_day: weekDay
                    }
                }
            }
        })

        const day = await prisma.day.findUnique({
            where: {
                date: parsedDate.toDate()
            },
            include: {
                dayHabits: true
            }
        })

        const completedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.habit_id
        })
        
        return {
            possibleHabits,
            completedHabits
        }
    })

    // completar / descompletar um hábito
    app.patch('/habits/:id/toggle', async (req) => {
        const toggleHabitParams = z.object({
            id: z.string().uuid(),
        })

        const { id } = toggleHabitParams.parse(req.params)

        const today = dayjs().startOf('day').toDate()

        let day = await prisma.day.findUnique({
            where: {
                date: today
            }
        })

        if (!day) {
            day = await prisma.day.create({
                data: {
                    date: today
                }
            })
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id,
                }
            }
        })

        if(dayHabit) {
            // remover marcação de completo
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id
                }
            })
        } else {
            // completando o hábito
            await prisma.dayHabit.create({
                data: {
                    day_id: day.id,
                    habit_id: id               
                }
            })
        }        
    })

    // continua em 14:28
}

